import * as yaml from 'js-yaml'
import { WorkResource } from './resource'
import { createDiff, ResourceDiffType } from './diff-resource'

const RANKS: Rank[] = [
    'phylum',
    'class',
    'infraclass',
    'superorder',
    'order',
    'suborder',
    'infraorder',
    'superfamily',
    'family',
    'subfamily',
    'tribe',
    'subtribe',
    'genus',
    'subgenus',
    'section', // not ICZN
    'subsection', // not ICZN
    'series', // not ICZN
    'group',
    'subgroup', // ...
    'aggregate', // not ICZN
    'complex', // not ICZN
    'species',
    'subspecies',
    'variety',
    'form',
    'aberration', // not ICZN
    'race', // not ICZN
    'stirps' // not ICZN
]

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
    'MISSING_SYNONYMS'
]

const TAXONOMIC_STATUS: Record<string, TaxonStatus> = {
    '>': 'incorrect',
    '+': 'heterotypic synonym',
    '=': 'synonym'
}

const INDET_SUFFIXES = new Set([
    'sp.',
    'spec.',
    'indet.',
    'sp. indet.',
    'spec. indet.'
])

const RANK_LABELS: Record<Rank, string> = {
    'subspecies': 'subsp.',
    'variety': 'var.',
    'form': 'f.',
    'aberration': 'ab.',
    'race': 'r.',
    'stirps': 'st.'
}

const RANK_LABELS_REVERSE: Record<string, Rank> = {
    'st': 'stirps',
    'r': 'race',
    'ab': 'aberration',
    'f': 'form',
    'var': 'variety',
    'ssp': 'subspecies',
    'subsp': 'subspecies'
}

const HYBRID_SIGN = '\u00D7'

/**
 *   1. Any number of
 *      - capitalized words
 *      - "&"
 *      - " in "
 *      - " ex "
 *      - lowercase name particles
 *   2. Followed by a capitalized word
 *   3. Optionally, followed by "et al."
 */
const LOWERCASE_NAME_PARTICLES = ['y', 'der', 'den', 'de', 'van', 'von'].join('|')
const SIMPLE_AUTHOR_PATTERN = '(?:(?:\\p{Lu}\\S*|&|in|ex|' + LOWERCASE_NAME_PARTICLES + ')\\s*)*\\p{Lu}\\S+(?:\\s+et\\s+al\\.)?'

const NAME_PATTERN = new RegExp(
    '^' +
        // $1 main name part
        '(\\S+)' +
        // $2 optional author citation
        '(?: ' +
            // but not auct(t)., etc.
            '(?!auctt?\\.|(?:syn|comb|sp|spec|nom)\\. n(?:ov)?\\.|s(?:ens[.u]|\\.)|in part|partim)' +
        '(' +
            // $2.1 anything in parentheses, followed by optional revising author(s)
            '\\(.+?\\)(?:\\s+' + SIMPLE_AUTHOR_PATTERN + ')?' +
        '|' +
            // $2.2 anything followed by a year
            '.+?\\d{4}\\)?' +
        '|' +
            // $2.3 author(s)
            SIMPLE_AUTHOR_PATTERN +
        '))?' +
        // $3 optional notes
        '(?:,? (.+))?' +
    '$',
    'u'
)

/**
 * Structure
 *   $1 genus+subgenus (+ trailing space): (?:([A-Z]\S+) (?:\(([A-Z]\S+?)\) )?)?
 *     $1.1 genus: ((?:x )?[A-Z]\S+)
 *     $1.2 subgenus: (?:\(([A-Z]\S+?)\) )?
 *   $2 species: (x [a-z]+|[a-z][^\s.]+(?: x [a-z]+)?|[A-Z][a-z]+_[a-z]+ x [A-Z][a-z]+_[a-z]+)
 *     $2a: x [a-z]+
 *     $2b hybrid: [a-z][^\s.]+(?: x [a-z]+)?
 *     $2c intergeneric hybrid: [A-Z][a-z]+_[a-z]+ x [A-Z][a-z]+_[a-z]+
 */
const BINAME_PATTERN = /^(?:((?:x )?[A-Z]\S+) (?:\(([A-Z]\S+?)\) )?)?(x [a-z]+|[a-z][^\s.]+(?: x [a-z]+)?|[A-Z][a-z]+_[a-z]+ x [A-Z][a-z]+_[a-z]+)(?= |$)/

function compareRanks (a: Rank, b: Rank): number {
    return RANKS.indexOf(a) - RANKS.indexOf(b)
}

function capitalize (name: string): string {
    return name[0].toUpperCase() + name.slice(1).toLowerCase()
}

function capitalizeGenericName (name: string): string {
    if (name[0] === HYBRID_SIGN) {
        return HYBRID_SIGN + capitalize(name.slice(1))
    }

    return capitalize(name)
}

function isUpperCase (name: string): boolean {
    return name === name.toUpperCase()
}

function getSynonymRank (name: string, rank: Rank): Rank {
    const rest = name.replace(BINAME_PATTERN, '')
    const rankPrefix = rest.match(/^(?: |^)(st|r|ab|f|var|ssp|subsp)\. /)
    if (rankPrefix) {
        return RANK_LABELS_REVERSE[rankPrefix[1]] as string
    } else if (!BINAME_PATTERN.test(name)) {
        return rank
    } else if (/^ (?!sensu)[a-z0-9-]+($| )/.test(rest)) {
        return 'subspecies'
    } else {
        return 'species'
    }
}

function capitalizeAuthors (authors: string): string {
    return authors
        .replace(
            /[^\x00-\x40\x5B-\x60\x7B-\x7F]+/g, // eslint-disable-line no-control-regex
            name => isUpperCase(name) ? capitalize(name) : name
        )
        .replace(/ Y /g, ' y ')
}

function parseName (name: string, rank: Rank, parent: WorkingTaxon): WorkingTaxon {
    const item = {} as WorkingTaxon

    // Synonyms have the accepted name usage as 'parent'.
    const isSynonym = /^[+=>] /.test(name)
    if (isSynonym) {
        item.taxonomicStatus = TAXONOMIC_STATUS[name[0]]
        name = name.replace(/^[+=>] (\? ?)?/, '')
        rank = getSynonymRank(name, parent.taxonRank as Rank)
    } else {
        item.taxonomicStatus = 'accepted'
    }

    // Clusters
    if (/^\[(_|\d+)\] /.test(name)) {
        name = name.replace(/^\[(_|\d+)\] /, '')
    }

    // Set verbatim identification after subsequent syntax is removed.
    item.verbatimIdentification = name.replace(/(?<=^| )x(?=$| )/g, HYBRID_SIGN).replace(/_/g, ' ')

    // Parent context is used for parsing and formatting binomial names.
    // For formatting, it needs to match external databases (i.e. be correct).
    // For parsing, it needs to match the current file. If relevant parents
    // (i.e. genus, species) had mistakes that were corrected, the uncorrected
    // genus and species names need to be used.
    const parentContext = {
        genus: parent.genus,
        subgenus: parent.subgenus,
        specificEpithet: parent.specificEpithet,
        incorrect: {
            genus: parent.incorrect && parent.incorrect.genus,
            specificEpithet: parent.incorrect && parent.incorrect.specificEpithet
        }
    }

    // Both contexts should be amended in the two cases where binomial names
    // are fully used: (1) synonyms and (2) multinomial taxa without parents to
    // provide parts of the name (e.g. bare species without a genus parent, or
    // even subspecies without a species or genus parent).
    if (isSynonym || !parentContext.genus || (compareRanks('species', rank) < 0 && !parentContext.specificEpithet)) {
        const [, genus, subgenus, species] = name.match(BINAME_PATTERN) || []
        if (genus) {
            parentContext.incorrect.genus = genus
            parentContext.genus = capitalizeGenericName(genus.replace(/(^| )x /, HYBRID_SIGN))
        }
        if (subgenus) {
            parentContext.subgenus = capitalize(subgenus)
        } else if (genus) {
            // If a genus is given but no subgenus, remove any existing subgenus
            // from the parent context.
            delete parentContext.subgenus
        }
        if (species && compareRanks('species', rank) < 0) {
            parentContext.incorrect.specificEpithet = species
            parentContext.specificEpithet = species.replace(/(^| )x /, HYBRID_SIGN)
        }
    }

    // In taxa of group, species or lower, the name should just contain the
    // (infra)specific epithet and the author information & remarks when processing
    // further.
    if (compareRanks('group', rank) <= 0) {
        // Remove genus
        const genus = parentContext.incorrect.genus || parentContext.genus || ''
        if (name[0] === genus[0] && name.toLowerCase().startsWith(genus.toLowerCase() + ' ')) {
            name = name.slice(genus.length + 1)
        }

        // Remove subgenus
        name = name.replace(/^\(.*?\) /, '')

        // Infraspecific taxa
        if (compareRanks('species', rank) < 0) {
            // Remove specific epithet
            const species = parentContext.incorrect.specificEpithet || parentContext.specificEpithet || ''
            if (name.startsWith(species + ' ')) {
                name = name.slice(species.length + 1)
            }

            // Remove rank abbreviations
            name = name.replace(/^(st|r|ab|f|var|ssp|subsp)\. /, '')
        }
    }

    // Hybrids
    if (rank === 'genus' && name.startsWith('x ')) {
        name = HYBRID_SIGN + name.slice(2)
    }

    if (rank === 'species' && /(^| )x /.test(name)) {
        name = name.replace(/(^| )x /, HYBRID_SIGN)
    }

    // Divide the name into the main scientific name (only the epithet for taxa
    // lower than genus), the authorship information, and optionally remarks
    const nameParts = name.match(NAME_PATTERN)
    if (!nameParts) {
        throw new Error(`Taxon "${name}" could not be parsed`)
    }

    // To encode old names with spaces (e.g. "Orsillus pini canariensis Lindberg, 1953")
    // underscores are used, which are replaced here. This is also used for undescribed
    // species (e.g. "Leiobunum species A") and intergeneric hybrids (e.g. "×Festulpia
    // Festuca rubra × Vulpia bromoides")
    if (nameParts[1].includes('_')) {
        nameParts[1] = nameParts[1].replace(/_/g, ' ')
    }

    const [_, taxon, citation = '', notes] = nameParts
    item.scientificNameAuthorship = capitalizeAuthors(citation)
    item.taxonRemarks = notes
    item.taxonRank = rank

    if (/[^\p{L}0-9\u{00D7}\- ]/u.test(taxon) && !INDET_SUFFIXES.has(taxon)) {
        throw new Error(`Taxon name contains unexpected characters: "${taxon}"`)
    }

    // Validate names and recompose binomial and trinomial names
    if (rank === 'genus') {
        item.scientificName = capitalizeGenericName(taxon)
        if (taxon[0].toUpperCase() !== taxon[0] || (taxon[0] === HYBRID_SIGN && taxon[1].toUpperCase() !== taxon[1])) {
            throw new Error(`Generic epithet should be capitalized: "${taxon}"`)
        }
    } else if (compareRanks('group', rank) > 0) {
        item.scientificName = capitalize(taxon)
        if (taxon[0].toUpperCase() !== taxon[0]) {
            throw new Error(`Taxon name (${rank}) should be capitalized: "${taxon}"`)
        }
    } else if (rank === 'group') {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        const specificEpithet = taxon.toLowerCase().replace(/(-group)?$/, '')
        item.scientificName = `${item.genericName} ${specificEpithet}-group`
        if (taxon.toLowerCase() !== taxon) {
            console.log(item, taxon)
            throw new Error(`Group name should be lowercase: "${taxon}"`)
        }
    } else if (rank === 'subgroup') {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        const specificEpithet = taxon.toLowerCase().replace(/(-subgroup)?$/, '')
        item.scientificName = `${item.genericName} ${specificEpithet}-subgroup`
        if (taxon.toLowerCase() !== taxon) {
            console.log(item, taxon)
            throw new Error(`Subgroup name should be lowercase: "${taxon}"`)
        }
    } else if (rank === 'species') {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        if (taxon.toLowerCase() !== taxon && !/^[A-Z][a-z]+ [a-z]+\xD7[A-Z][a-z]+ [a-z]+$/.test(taxon)) {
            console.log(item, taxon)
            throw new Error(`Specific epithet should be lowercase: "${taxon}"`)
        }
        item.specificEpithet = taxon
        item.scientificName = `${item.genericName} ${item.specificEpithet}`
    } else if (compareRanks('species', rank) < 0) {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        item.specificEpithet = parentContext.specificEpithet
        item.infraspecificEpithet = taxon.toLowerCase()

        // If possible, names below species should have abbreviations for ranks,
        // like "subsp."
        const nameParts = [
            item.genericName,
            item.specificEpithet,
            item.infraspecificEpithet
        ]
        if (item.taxonRank in RANK_LABELS) {
            nameParts.splice(2, 0, RANK_LABELS[item.taxonRank])
        }
        item.scientificName = nameParts.join(' ')

        if (item.infraspecificEpithet !== taxon) {
            console.log(item, taxon)
            throw new Error(`Infraspecific epithet should be lowercase: "${taxon}"`)
        }
    }

    // Re-add authorship information
    item.scientificNameOnly = item.scientificName
    if (item.scientificNameAuthorship) {
        item.scientificName += ` ${item.scientificNameAuthorship}`
    }

    return item
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

    return Array.from(INDET_SUFFIXES).some(suffix => line.endsWith(' ' + suffix))
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
