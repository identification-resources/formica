import * as yaml from 'js-yaml'
import { WorkResource } from './resource'
import { createDiff, ResourceDiffType } from './diff-resource'
import { parseName, RANKS, RecoverableSyntaxError } from './parse-name'

const MAIN_RANKS: Rank[] = [
    'kingdom',
    'phylum',
    'class',
    'order',
    'family',
    'genus',
    'species'
]

const DWC_RANKS: DwcRank[] = [
    'kingdom',
    'phylum',
    'class',
    'order',
    'family',
    'subfamily',
    'genus',
    'subgenus'
]

const FLAGS: ResourceFlag[] = [
    'MISSING_TAXA',
    'MISSING_PARENT_TAXA',
    'MISSING_SYNONYMS',
    'MISSING_AUTHORSHIP'
]

const RESOURCE_DELIMITER = '\n\n===\n\n'
const INDENT = 2

function makeParseError (message: string, line: number, column: number = 1): SyntaxError {
    return new SyntaxError(`[${line}:${column}] ${message}`)
}

function mergeParserErrors (errors: SyntaxError[]): SyntaxError {
    return new SyntaxError(errors.map(error => error.message).join('\n'))
}

function parseHeader (header: string): ResourceMetadata {
    const config = yaml.load(header)

    if (typeof config !== 'object' || Array.isArray(config) || config === null) {
        throw new SyntaxError('yaml header should be an object')
    }

    // Invalid configuration
    let levels
    if (!('levels' in config)) {
        levels = []
    } else if (!Array.isArray(config.levels)) {
        throw new SyntaxError('"levels" should be an array')
    } else {
        levels = config.levels
    }

    if ('scope' in config) {
        throw new SyntaxError('"scope" data should go in "catalog"')
    }

    // No taxon ranks
    if (levels.length === 0) {
        throw new SyntaxError('Resource contains no taxa')
    }

    // Invalid taxon ranks
    const invalidTaxonRanks = levels.filter(rank => !RANKS.includes(rank))
    if (invalidTaxonRanks.length) {
        throw new SyntaxError(`"levels" contains invalid values: ${invalidTaxonRanks.join(', ')}`)
    }

    const metadata: ResourceMetadata = { levels }

    if ('catalog' in config && typeof config.catalog === 'object' && config.catalog !== null) {
        const catalog: Record<string, string> = {}
        if ('id' in config.catalog) {
            throw new SyntaxError('"catalog" should not contain id')
        }
        for (const key in config.catalog) {
            const value = config.catalog[key as keyof object]
            if (typeof value === 'number') {
                catalog[key] = (value as number).toString()
            } else if (typeof value === 'string') {
                catalog[key] = value
            } else {
                throw new SyntaxError(`"catalog" should contain only strings ("${key}")`)
            }
        }
        const work = new WorkResource(catalog)
        const errors = work.validate().filter(({ error }) => error !== 'Value(s) required but missing')
        if (errors.length > 0) {
            throw new SyntaxError(`"catalog" contains errors: ${errors.map(({ field, error }) => `[${field}] ${error}`).join('; ')}`)
        }
        metadata.catalog = {}
        for (const key in work.fields) {
            metadata.catalog[key] = work.get(key) as Value
        }
    }

    if ('flags' in config) {
        if (!Array.isArray(config.flags)) {
            throw new SyntaxError('"flags" should be an array if present')
        }

        const invalidFlags = config.flags.filter(flag => !FLAGS.includes(flag))
        if (invalidFlags.length) {
            throw new SyntaxError(`"flags" contains invalid values: ${invalidFlags.join(', ')}`)
        }

        metadata.flags = config.flags
    }

    return metadata
}

function parseResource (resource: FilePart): [ResourceMetadata, FilePart] {
    const [header, _, ...rest] = resource.content.split(/(\n---\n+)/)
    let config

    try {
        config = parseHeader(header)
    } catch (error) {
        throw makeParseError(error.message, resource.offsetLine + 1)
    }

    const content = rest.join('')
    const offsetLine = resource.offsetLine + (header + _).split('\n').length - 1

    return [config, { content, offsetLine }]
}

function getTaxonChildren (parent: TaxonId|undefined, taxa: Record<TaxonId, WorkingTaxon>): WorkingTaxon[] {
    const children = []
    for (const id in taxa) {
        if (taxa[id].parentNameUsageID === parent) {
            children.push(taxa[id])
        }
    }
    return children
}

function processClusters (taxa: Record<TaxonId, WorkingTaxon>) {
    for (const id in taxa) {
        const taxon = taxa[id]
        if (taxon.taxonomicStatus !== 'accepted' || !taxon.cluster) {
            continue
        }

        const dynamicProperties = taxon.dynamicProperties ? JSON.parse(taxon.dynamicProperties) : {}

        if (taxon.cluster === '_') {
            dynamicProperties.identifiable = false
        } else {
            const siblings = getTaxonChildren(taxon.parentNameUsageID, taxa).filter(sibling => sibling.scientificNameID !== id)
            dynamicProperties.indistinguishableFrom = siblings.filter(sibling => sibling.cluster === taxon.cluster).map(sibling => sibling.scientificNameID)
        }

        taxon.dynamicProperties = JSON.stringify(dynamicProperties)
    }
}

function parseResourceContent (content: ResourceDiff, resource: Resource, oldIds: number[], offsetLine: number): Resource {
    const leafTaxonIndex = resource.metadata.levels.reduce((last, rank, i) => MAIN_RANKS.includes(rank) ? i : last, 0)
    const data = resource.taxa as Record<TaxonId, WorkingTaxon>
    const errors = []

    let id = 0
    let newId = Math.max(...oldIds)
    let lineNumber = offsetLine

    const parents: Array<TaxonId | null> = []
    const previous = { id: '', indent: 0, group: { isLeaf: false, indent: 0 }, errors: <SyntaxError[]>[] }

    for (const line of content) {
        const hasOriginalId = line.type !== ResourceDiffType.Added && !/^\s*(\[indet\]|> )/.test(line.original ?? line.text as string)
        if (hasOriginalId) {
            id++
        }

        if (line.type === ResourceDiffType.Deleted) {
            continue
        } else {
            lineNumber++
        }

        const [indentation, name] = (line.text as string).match(/^(\s*)(.*)/)!.slice(1)
        const lineIndent = indentation.length

        // Validate line
        if (lineIndent % INDENT === 1) {
            errors.push(makeParseError('Too much or little indentation', lineNumber))
            continue
        } else if (lineIndent / INDENT >= resource.metadata.levels.length && !/^[+=>] /.test(name)) {
            errors.push(makeParseError('Too much indentation', lineNumber))
            continue
        } else if (lineIndent <= previous.group.indent && (data[previous.id] && !previous.group.isLeaf)) {
            errors.push(makeParseError('Missing leaf taxon', lineNumber - 1))
        }

        // Update parentage
        if (lineIndent > previous.indent) {
            // Do not count synonyms as parents (unless this is correcting a typo in the synonym)
            if (data[previous.id] && data[previous.id].taxonomicStatus === 'accepted' || name.startsWith('> ')) {
                parents.push(previous.id)
            } else {
                parents.push(null)
            }

            // Handle skips in indentation levels,
            // e.g. if a certain genus has only species
            // whereas other genera in the same key also
            // have subgenera
            for (let i = previous.indent + INDENT; i < lineIndent; i += INDENT) {
                parents.push(null)
            }
        } else if (lineIndent < previous.indent) {
            parents.splice(lineIndent / INDENT)
        }

        previous.indent = lineIndent

        // Do not process "indet" lines further, as they only serve to indicate
        // that subtaxa are explicitely omitted
        if (name.startsWith('[indet]')) {
            errors.push(...previous.errors)
            previous.errors.length = 0
            previous.group.isLeaf = lineIndent / INDENT >= leafTaxonIndex
            continue
        }

        const parentId = parents.reduce((grandparent, parent) => parent ?? grandparent, null)
        const parent = parentId === null ? {} as WorkingTaxon : data[parentId]
        let item
        const itemErrors = []

        try {
            const rank = resource.metadata.levels[parents.length]
            item = parseName(name, rank, parent)
        } catch (error) {
            if (error instanceof RecoverableSyntaxError) {
                itemErrors.push(makeParseError(error.message, lineNumber))
                item = error.result
            } else {
                errors.push(makeParseError(error.message, lineNumber))
                continue
            }
        }

        // Add higher classification info
        const itemAsObject = item as { [index: string]: unknown }
        const parentAsObject = parent as { [index: string]: unknown }
        for (const rank of DWC_RANKS) {
            itemAsObject[rank] = undefined
            if (parentAsObject[rank]) {
                itemAsObject[rank] = parentAsObject[rank]
            }
            if (item.taxonRank === rank) {
                itemAsObject[rank] = item.scientificNameOnly
            }
        }

        if (item.genericName && !item.genus) {
            item.genus = item.genericName
        }
        if (item.infragenericEpithet && !item.subgenus) {
            item.subgenus = item.infragenericEpithet
        }

        // Amend "parent" with corrections, exit
        if (item.taxonomicStatus === 'incorrect') {
            if (parent.taxonomicStatus !== 'accepted') {
                // Remove corrected synonym from parentage
                parents[parents.length - 1] = null
            }

            if (parent.incorrect) {
                errors.push(makeParseError('Cannot apply a correction to a previous correction', lineNumber))
                continue
            } else if (parentId === null) {
                errors.push(makeParseError('Cannot apply a correction to nothing', lineNumber))
                continue
            }

            parent.incorrect = { ...parent }
            for (const key in item) {
                if (key !== 'taxonomicStatus' && key !== 'verbatimIdentification') {
                    parentAsObject[key] = itemAsObject[key]
                }
            }

            // If "parent" is corrected, its errors can be dropped
            previous.errors.length = 0
            // ...but errors associated with the corrected name are added immediately
            errors.push(...itemErrors)

            continue
        }

        // Add more classification info
        const isSynonym = item.taxonomicStatus !== 'accepted'
        if (isSynonym) {
            item.higherClassification = parent.higherClassification
        } else if (parent.higherClassification) {
            item.higherClassification = parent.higherClassification + ` | ${parent.scientificNameOnly}`
        } else if (parentId) {
            item.higherClassification = parent.scientificNameOnly
        }

        // Set identifiers
        item.scientificNameID = `${resource.id}:${hasOriginalId ? (oldIds[id - 1] ?? id) : ++newId}`

        item.parentNameUsageID = isSynonym ? undefined : parent.scientificNameID
        item.parentNameUsage = isSynonym ? undefined : parent.scientificName
        item.acceptedNameUsageID = isSynonym ? parent.scientificNameID : undefined
        item.acceptedNameUsage = isSynonym ? parent.scientificName : undefined
        item.collectionCode = resource.id

        data[item.scientificNameID] = item

        // Update loop state
        errors.push(...previous.errors)
        previous.errors = itemErrors
        previous.id = item.scientificNameID
        if (item.taxonomicStatus === 'accepted') {
            previous.group.indent = previous.indent
            previous.group.isLeaf = lineIndent / INDENT >= leafTaxonIndex
        }
    }

    errors.push(...previous.errors)
    if (errors.length) {
        throw mergeParserErrors(errors)
    }

    processClusters(data)

    return resource
}

interface FilePart {
    content: string
    offsetLine: number
}

function splitResources (file: string): FilePart[] {
    const resources: FilePart[] = []
    let offsetLine = 0
    for (const content of file.split(RESOURCE_DELIMITER)) {
        resources.push({ content, offsetLine })
        offsetLine += (content + RESOURCE_DELIMITER).split('\n').length - 1
    }
    return resources
}

export function parseFile (file: string, id: WorkId, old?: ResourceHistory): Resource[] {
    const oldResources = old ? splitResources(old.txt) : []
    const newResources = splitResources(file)
    const resources: Resource[] = []
    const errors = []

    for (let index = 0; index < newResources.length; index++) {
        const [config, content] = parseResource(newResources[index])
        const template: Resource = {
            id: `${id}:${index + 1}`,
            file: `${id}-${index + 1}`,
            workId: id,
            metadata: config,
            taxa: {}
        }

        let diff
        if (oldResources[index]) {
            diff = createDiff(content.content, parseResource(oldResources[index])[1].content)
            // Ignore empty lines
            diff = diff.filter(line => line.text !== '')
        } else {
            diff = createDiff(content.content, content.content)
        }

        const oldIds = []
        if (old) {
            for (const row of old.dwc[index].slice(1)) {
                oldIds.push(parseInt(row[0].split(':')[2]))
            }
        }

        try {
            resources.push(parseResourceContent(diff, template, oldIds, content.offsetLine))
        } catch (error) {
            errors.push(error)
        }
    }

    if (errors.length) {
        throw mergeParserErrors(errors)
    }

    return resources
}

export function parseFileHeader (file: string): ResourceMetadata[] {
    return splitResources(file).map(resource => parseResource(resource)[0])
}
