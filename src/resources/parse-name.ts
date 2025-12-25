export class RecoverableSyntaxError<Result> extends SyntaxError {
    result: Result

    constructor (message: string, result: Result) {
        super(message)
        this.result = result
    }
}

export const RANKS: Rank[] = [
    'phylum',
    'subphylum',
    'class',
    'subclass',
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

const TAXONOMIC_STATUS: Record<string, TaxonStatus> = {
    '>': 'incorrect',
    '+': 'heterotypic synonym',
    '=': 'synonym'
}

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
            '(?!auctt?\\.|(?:syn|comb|sp|spec|nom|gen|subgen)\\. n(?:ov)?\\.|s(?:ens[.u]|\\.)|in part|partim)' +
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
 *   $1 genus: ((?:x )?[A-Z]\S+)
 *   $2 subgenus: (?:\(([A-Z]\S+?)\) )?
 */
const SUBGENUS_PATTERN = /^([A-Z]\S+) (?:\(([A-Z]\S+?)\))(?= |$)/

/**
 * Structure
 *   $1 genus+subgenus (+ trailing space): (?:([A-Z]\S+) (?:\(([A-Z]\S+?)\) )?)?
 *     $1.1 genus: ((?:x )?[A-Z]\S+)
 *     $1.2 subgenus: (?:\(([A-Z]\S+?)\) )?
 *   $2 species: (x [a-z-]+|[a-z-][^\s.]+(?: x [a-z-]+)?|[A-Z][a-z]+_[a-z-]+ x [A-Z][a-z]+_[a-z-]+)
 *     $2a: x [a-z-]+
 *     $2b hybrid: [a-z-][^\s.]+(?: x [a-z-]+)?
 *     $2c intergeneric hybrid: [A-Z][a-z]+_[a-z-]+ x [A-Z][a-z]+_[a-z-]+
 */
const BINAME_PATTERN = /^(?:((?:x )?[A-Z]\S+) (?:\(([A-Z]\S+?)\) )?)?(x [a-z-]+|[a-z-][^\s.]+(?: x [a-z-]+)?|[A-Z][a-z]+_[a-z-]+ x [A-Z][a-z]+_[a-z-]+)(?= |$)/

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
        return SUBGENUS_PATTERN.test(name) ? 'subgenus' : rank
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

export function parseName (name: string, rank: Rank, parent: WorkingTaxon): WorkingTaxon {
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
        const [, genus, subgenus, species] = name.match(BINAME_PATTERN) ?? name.match(SUBGENUS_PATTERN) ?? []
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
    } else if (compareRanks('genus', rank) <= 0) {
        // Remove genus
        const genus = parentContext.incorrect.genus || parentContext.genus || ''
        if (name[0] === genus[0] && name.toLowerCase().startsWith(genus.toLowerCase() + ' (')) {
            name = name.slice(genus.length + 1)
        }

        // Remove subgenus parentheses
        name = name.replace(/^\((.*?)\)/, '$1')
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
    item.genericName = undefined
    item.infragenericEpithet = undefined
    item.specificEpithet = undefined
    item.infraspecificEpithet = undefined

    if (/[^\p{L}0-9\u{00D7}\- ]/u.test(taxon)) {
        throw new RecoverableSyntaxError(`Taxon name contains unexpected characters: "${taxon}"`, item)
    }

    // Validate names and recompose binomial and trinomial names
    if (compareRanks('genus', rank) > 0) {
        item.scientificName = capitalize(taxon)
        if (taxon[0].toUpperCase() !== taxon[0]) {
            throw new RecoverableSyntaxError(`Taxon name (${rank}) should be capitalized: "${taxon}"`, item)
        }
    } else if (rank === 'genus') {
        item.scientificName = capitalizeGenericName(taxon)
        if (taxon[0].toUpperCase() !== taxon[0] || (taxon[0] === HYBRID_SIGN && taxon[1].toUpperCase() !== taxon[1])) {
            throw new RecoverableSyntaxError(`Generic epithet should be capitalized: "${taxon}"`, item)
        }
    } else if (compareRanks('group', rank) > 0) {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        item.scientificName = capitalize(taxon)
        if (taxon[0].toUpperCase() !== taxon[0]) {
            throw new RecoverableSyntaxError(`Infrageneric epithet should be capitalized: "${taxon}"`, item)
        }
    } else if (rank === 'group') {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        const specificEpithet = taxon.toLowerCase().replace(/(-group)?$/, '')
        item.scientificName = `${item.genericName} ${specificEpithet}-group`
        if (taxon.toLowerCase() !== taxon) {
            throw new RecoverableSyntaxError(`Group name should be lowercase: "${taxon}"`, item)
        }
    } else if (rank === 'subgroup') {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        const specificEpithet = taxon.toLowerCase().replace(/(-subgroup)?$/, '')
        item.scientificName = `${item.genericName} ${specificEpithet}-subgroup`
        if (taxon.toLowerCase() !== taxon) {
            throw new RecoverableSyntaxError(`Subgroup name should be lowercase: "${taxon}"`, item)
        }
    } else if (compareRanks('species', rank) > 0) {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        const specificEpithet = taxon.toLowerCase()
        item.scientificName = `${item.genericName} ${specificEpithet}`
        if (specificEpithet !== taxon) {
            throw new RecoverableSyntaxError(`Taxon name should be lowercase: "${taxon}"`, item)
        }
    } else if (rank === 'species') {
        item.genericName = parentContext.genus
        item.infragenericEpithet = parentContext.subgenus
        if (taxon.toLowerCase() !== taxon && !/^[A-Z][a-z]+ [a-z]+\xD7[A-Z][a-z]+ [a-z]+$/.test(taxon)) {
            throw new RecoverableSyntaxError(`Specific epithet should be lowercase: "${taxon}"`, item)
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
            throw new RecoverableSyntaxError(`Infraspecific epithet should be lowercase: "${taxon}"`, item)
        }
    }

    // Re-add authorship information
    item.scientificNameOnly = item.scientificName
    if (item.scientificNameAuthorship) {
        item.scientificName += ` ${item.scientificNameAuthorship}`
    }

    return item
}
