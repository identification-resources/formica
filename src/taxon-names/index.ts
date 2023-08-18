const MINIMUM_PREFIX_LENGTH = 3
const VALID_COMMON_PREFIXES = new Set([
    'Plantae|Tracheophyta',
    'Fungi',
    'Fungi|Ascomycota',
    'Fungi|Basidiomycota',
    'Fungi|Zygomycota'
])

function getCommonPrefix (a: string[], b: string[]): string[] {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
            return a.slice(0, i)
        }
    }
    return a.slice()
}

function isValidPrefix (a: string[], b: string[]): boolean {
    const prefix = getCommonPrefix(a, b)
    return VALID_COMMON_PREFIXES.has(prefix.join('|')) || prefix.length >= MINIMUM_PREFIX_LENGTH
}

export function groupNameMatches (results: Record<TaxonId, TaxonMatch[]>): GroupedNameMatches {
    const prefixes: Record<string, [string[], Record<TaxonId, TaxonMatch>][]> = {}

    for (const scientificNameID in results) {
        for (const result of results[scientificNameID]) {
            if (!prefixes[result.source]) {
                prefixes[result.source] = []
            }

            let prefix = prefixes[result.source].find(prefix => isValidPrefix(prefix[0], result.classificationPath))

            if (!prefix) {
                prefix = [result.classificationPath, {}]
                prefixes[result.source].push(prefix)
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
    for (const source in prefixes) {
        groupedNameMatches[source] = prefixes[source]
            .sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)
            .reduce((map: Record<string, Record<TaxonId, TaxonMatch>>, [prefix, taxa]) => {
                map[prefix.join('|')] = taxa
                return map
            }, {})
    }

    return groupedNameMatches
}

export function amendResource (resource: AmendedResource, source: string, matches: Record<TaxonId, TaxonMatch>) {
    for (const id in matches) {
        const match = matches[id]

        if (source === '1') {
            resource.taxa[id].colTaxonID = match.id
            if (match.currentId) {
                resource.taxa[id].colAcceptedTaxonID = match.currentId
            }
        } else if (source === '11') {
            resource.taxa[id].gbifTaxonID = match.id
            if (match.currentId) {
                resource.taxa[id].gbifAcceptedTaxonID = match.currentId
            }
        }
    }
}
