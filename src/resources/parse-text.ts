import * as yaml from 'js-yaml'
import { WorkResource } from './resource'
import { createDiff, ResourceDiffType } from './diff-resource'
import { parseName, RANKS } from './parse-name'

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

function validateResource (config: ResourceMetadata, content: string) {
    // Check for too much indentation
    const longerIndent = new RegExp(`^(  ){${config.levels.length - 1}}(?!  [+=>] |    > ) `, 'm')
    const longerIndentMatch = content.match(longerIndent)
    if (longerIndentMatch !== null) {
        const offset = longerIndentMatch.index
        const line = (content.slice(0, offset).match(/\n/g) || []).length + 1
        throw new SyntaxError(`Too much indentation at ${line}:0
${content.slice(offset).split('\n', 1)}
^`)
    }

    // Check for missing leaf taxa
    const leafTaxonRank = config.levels.filter(rank => MAIN_RANKS.includes(rank)).pop() as string
    const leafTaxonParentIndent = config.levels.indexOf(leafTaxonRank) - 1
    if (leafTaxonRank && leafTaxonParentIndent >= 0) {
        const missingLeafTaxa = new RegExp(`^((?:  ){0,${leafTaxonParentIndent}})(?![+=> ] ).*\\n(\\1(  )+[+=>].*\\n)*(?!\\1  )`, 'm')
        const missingLeafTaxaMatch = content.match(missingLeafTaxa)
        if (missingLeafTaxaMatch !== null) {
            const offset = missingLeafTaxaMatch.index
            const line = (content.slice(0, offset).match(/\n/g) || []).length + 1
            throw new SyntaxError(`Missing leaf taxon at ${line}:0
${content.slice(offset).split('\n', 1)}
^`)
        }
    }
}

function parseResource (resource: string): [ResourceMetadata, string] {
    const [header, _, ...rest] = resource.split(/(\n---\n+)/)
    const config = parseHeader(header)
    const content = rest.join('')

    return [config, content]
}

function getIndentation (line: string): number {
    return (line.match(/^ */) as string[])[0].length
}

function isIndetLine (line: string, indent?: number): boolean {
    if (indent === undefined) {
        indent = getIndentation(line)
    }

    line = line.slice(indent)

    return line.startsWith('[indet]')
}

function parseResourceContent (content: ResourceDiff, resource: Resource, oldIds: number[]): Resource {
    const idBase = `${resource.id}:`

    const data = resource.taxa as Record<TaxonId, WorkingTaxon>
    let id = 0
    let parents: Array<TaxonId | null> = []
    let groupIndent = 0
    let previousId = ''
    let newIdOffset = Math.max(...oldIds)

    for (const line of content) {
        if (line.type === ResourceDiffType.Deleted) {
            // Increase id counter for removed line unless it was an "indet line"
            if (!isIndetLine(line.original as string)) {
                id++
            }
            continue
        }

        const lineIndent = getIndentation(line.text as string)
        if (lineIndent > groupIndent) {
            // Do not count synonyms as parents (unless this is correcting a typo in the synonym)
            if (data[previousId] && data[previousId].taxonomicStatus === 'accepted' || /^( {2})+> /.test(line.text as string)) {
                parents.push(previousId)
            } else {
                parents.push(null)
            }
            // Handle skips in indentation levels,
            // e.g. if a certain genus has only species
            // whereas other genera in the same key also
            // have subgenera
            if ((lineIndent - groupIndent) > 2) {
                const gap = (lineIndent - groupIndent - 2) / 2
                for (let i = 0; i < gap; i++) { parents.push(null) }
            }
            groupIndent = lineIndent
        } else if (lineIndent < groupIndent) {
            parents = parents.slice(0, lineIndent / 2)
            groupIndent = lineIndent
        }

        // Do not process "indet" lines further, as they only serve to indicate
        // that subtaxa are explicitely omitted
        if (isIndetLine(line.text as string, lineIndent)) {
            // If the line was previously not and ndet line, increase the id counter
            if (line.type === ResourceDiffType.Modified && !isIndetLine(line.original as string)) {
                id++
            }
            continue
        }

        const parentId = parents.reduce((grandparent, parent) => parent || grandparent, null)
        const parent = parentId === null ? {} as WorkingTaxon : data[parentId]
        const name = (line.text as string).slice(groupIndent)
        const rank = resource.metadata.levels[groupIndent / 2]
        const item = parseName(name, rank, parent)
        const isSynonym = item.taxonomicStatus !== 'accepted'

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

        if (isSynonym) {
            item.higherClassification = parent.higherClassification
        } else if (parent.higherClassification) {
            item.higherClassification = parent.higherClassification + ` | ${parent.scientificNameOnly}`
        } else if (parentId) {
            item.higherClassification = parent.scientificNameOnly
        }

        // Amend "parent" with corrections
        if (item.taxonomicStatus === 'incorrect') {
            parent.incorrect = { ...parent }
            for (const key in item) {
                if (key !== 'taxonomicStatus' && key !== 'verbatimIdentification') {
                    parentAsObject[key] = itemAsObject[key]
                }
            }
            continue
        }

        // Set identifiers
        if (line.type === ResourceDiffType.Added) {
            newIdOffset++
            item.scientificNameID = idBase + newIdOffset.toString()
        } else if (line.type === ResourceDiffType.Modified && isIndetLine(line.original as string)) {
            newIdOffset++
            item.scientificNameID = idBase + newIdOffset.toString()
        } else {
            id++
            item.scientificNameID = idBase + (oldIds[id - 1] || id).toString()
        }
        previousId = item.scientificNameID

        item.parentNameUsageID = isSynonym ? undefined : parent.scientificNameID
        item.parentNameUsage = isSynonym ? undefined : parent.scientificName
        item.acceptedNameUsageID = isSynonym ? parent.scientificNameID : undefined
        item.acceptedNameUsage = isSynonym ? parent.scientificName : undefined
        item.collectionCode = idBase.slice(0, -1)

        data[item.scientificNameID] = item
    }

    return resource
}

function splitResources (file: string): string[] {
    return file.split('\n\n===\n\n')
}

export function parseFile (file: string, id: WorkId, old?: ResourceHistory): Resource[] {
    const oldResources = old ? splitResources(old.txt) : []
    return splitResources(file).map((resource, index) => {
        const [config, content] = parseResource(resource)
        validateResource(config, content)
        const template: Resource = {
            id: `${id}:${index + 1}`,
            file: `${id}-${index + 1}`,
            workId: id,
            metadata: config,
            taxa: {}
        }

        let diff
        if (oldResources[index]) {
            diff = createDiff(content, parseResource(oldResources[index])[1])
            // Ignore empty lines
            diff = diff.filter(line => line.text !== '')
        } else {
            diff = createDiff(content, content)
        }

        const oldIds = []
        if (old) {
            for (const row of old.dwc[index].slice(1)) {
                oldIds.push(parseInt(row[0].split(':')[2]))
            }
        }

        return parseResourceContent(diff, template, oldIds)
    })
}

export function parseFileHeader (file: string): ResourceMetadata[] {
    return splitResources(file).map(resource => parseResource(resource)[0])
}
