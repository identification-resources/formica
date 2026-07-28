const RANKS = [
    'superdomain',
    'domain',
    'kingdom',
    'subkingdom',
    'phylum',
    'subphylum',
    'infraphylum',
    'parvphylum',
    'gigaclass',
    'megaclass',
    'superclass',
    'class',
    'subclass',
    'infraclass',
    'subterclass',
    'superorder',
    'order',
    'suborder',
    'infraorder',
    'parvorder',
    'section zoology',
    'subsection zoology',
    'series zoology',
    'superfamily',
    'epifamily',
    'family',
    'subfamily',
    'tribe',
    'subtribe',
    'genus',
    'subgenus',
    'section',
    'group',
    'aggregate',
    'complex',
    'species',
    'subspecies',
    'variety',
    'form'
]

const MINIMUM_PREFIX_RANK = 'class'
const VALID_COMMON_PREFIXES = {
    col: new Set([
        'Eukaryota|Animalia|Mollusca',
        'Eukaryota|Plantae|Bryobiotina|Bryophyta',
        'Eukaryota|Plantae|Pteridobiotina|Tracheophyta',
        'Eukaryota|Fungi',
        'Eukaryota|Fungi|Ascomycota',
        'Eukaryota|Fungi|Basidiomycota',
        'Eukaryota|Fungi|Zygomycota'
    ]),
    gbif: new Set([
        'Plantae|Tracheophyta',
        'Fungi',
        'Fungi|Ascomycota',
        'Fungi|Basidiomycota',
        'Fungi|Zygomycota'
    ])
}

function compareRanks (a: string, b: string): number {
    return RANKS.indexOf(a) - RANKS.indexOf(b)
}

function getCommonPrefix (a: TaxonMatchClassificationPath, b: TaxonMatchClassificationPath): TaxonMatchClassificationPath {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] && b[i] && a[i].name !== b[i].name) {
            return a.slice(0, i)
        }
    }
    return a.slice()
}

function isValidPrefix (a: TaxonMatchClassificationPath, b: TaxonMatchClassificationPath, source: ResourceTaxonIdSource): boolean {
    const prefix = getCommonPrefix(a, b)

    if (prefix.length === 0) {
        return false
    }

    if (VALID_COMMON_PREFIXES[source].has(formatClassificationPath(prefix))) {
        return true
    }

    return compareRanks(prefix[prefix.length - 1].rank, MINIMUM_PREFIX_RANK) >= 0
}

export enum ResourceTaxonIdSource {
    COL = 'col',
    GBIF = 'gbif'
}

export function formatClassificationPath (path: TaxonMatchClassificationPath): string {
    return path.map(part => part.name).join('|')
}

export function groupNameMatches (results: Record<TaxonId, TaxonMatch[]>): GroupedNameMatches {
    const prefixes: Partial<Record<ResourceTaxonIdSource, Array<[TaxonMatchClassificationPath, Record<TaxonId, TaxonMatch>]>>> = {}

    for (const scientificNameID in results) {
        for (const result of results[scientificNameID]) {
            const matchGroups = prefixes[result.source] ?? (prefixes[result.source] = [])
            let prefix = matchGroups.find(prefix => isValidPrefix(prefix[0], result.classificationPath, result.source))

            if (!prefix) {
                prefix = [result.classificationPath, {}]
                matchGroups.push(prefix)
            } else {
                prefix[0] = getCommonPrefix(prefix[0], result.classificationPath)
            }

            if (scientificNameID in prefix[1]) {
                continue
            }

            prefix[1][scientificNameID] = result
        }
    }

    const groupedNameMatches: GroupedNameMatches = {}

    for (const [source, matchGroups] of Object.entries(prefixes)) {
        groupedNameMatches[source as ResourceTaxonIdSource] = matchGroups
            .sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)
            .reduce((map: Record<string, Record<TaxonId, TaxonMatch>>, [prefix, taxa]) => {
                map[formatClassificationPath(prefix)] = taxa
                return map
            }, {})
    }

    return groupedNameMatches
}

export function amendResource (resource: AmendedResource, source: ResourceTaxonIdSource, matches: Record<TaxonId, TaxonMatch>) {
    for (const id in matches) {
        const match = matches[id]

        if (source === ResourceTaxonIdSource.COL) {
            resource.taxa[id].colTaxonID = match.id
            if (match.currentId) {
                resource.taxa[id].colAcceptedTaxonID = match.currentId
            }
        } else if (source === ResourceTaxonIdSource.GBIF) {
            resource.taxa[id].gbifTaxonID = match.id
            if (match.currentId) {
                resource.taxa[id].gbifAcceptedTaxonID = match.currentId
            }
        }
    }
}
