const { suite, test } = require('node:test')
const assert = require('assert')

const { catalog, resources } = require('../lib')

suite('catalog', () => {
    test('reports missing required fields', () => {
        const errors = catalog.loadData(`id
B1`, 'catalog').validate()
        assert.deepStrictEqual(errors, [
            { entity: 'B1', field: 'title', error: 'Value(s) required but missing' },
            { entity: 'B1', field: 'entry_type', error: 'Value(s) required but missing' },
            { entity: 'B1', field: 'language', error: 'Value(s) required but missing' },
            { entity: 'B1', field: 'key_type', error: 'Value(s) required but missing' },
            { entity: 'B1', field: 'taxon', error: 'Value(s) required but missing' },
            { entity: 'B1', field: 'region', error: 'Value(s) required but missing' }
        ])
    })
})

suite('resources', () => {
    test('parses author with initials', () => {
        const [resource] = resources.parseTextFile(`---
levels: [family, genus, species]
---

    Dolichurus haemorrhous A. Costa, 1886
  Dolichurus A. Costa, 1886
    [indet]
Sphecidae A. Costa, 1886
    [indet]
`, 'T1')
        assert.deepStrictEqual(Object.values(resource.taxa).map(taxon => taxon.scientificNameAuthorship), Array(3).fill('A. Costa, 1886'))
    })

    test('parses synonyms starting with intraspecific ranks', () => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Lygaeus equestris (Linnaeus, 1758)
  = f. lactans Horváth, 1899
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Lygaeus equestris f. lactans Horváth, 1899')
    })

    test('parses accepted taxa starting with intraspecific ranks', () => {
        const [resource] = resources.parseTextFile(`---
levels: [species, form]
---

Lygaeus equestris (Linnaeus, 1758)
  f. lactans Horváth, 1899
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Lygaeus equestris f. lactans Horváth, 1899')
    })

    test('parses names containing non-ASCII characters', () => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Nematus fåhraei Thomson
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Nematus fåhraei Thomson')
    })

    test('parses synonyms in different genera', () => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Katamenes arbustorum subsp. burlinii
  > arbustorum subsp. burlinii
  = Eumenes arbustorum var. burlinii
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Eumenes arbustorum var. burlinii')
    })

    test('parses species without generic names', () => {
        const [resource] = resources.parseTextFile(`---
levels: [genus, subgenus, species]
---

Microdynerus Thomson, 1874
  Alastorynerus Blüthgen, 1938
    microdynerus (Dalla Torre, 1889)
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:3'].scientificName, 'Microdynerus microdynerus (Dalla Torre, 1889)')
    })

    test('parses hybrids', () => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Rumex conglomeratus x maritimus
Tilia x vulgaris
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Rumex conglomeratus×maritimus')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Tilia ×vulgaris')
    })

    test('parses cross-genus hybrids', () => {
        const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

x Triticosecale
  [indet]
x Festulpia
  Festuca_rubra x Vulpia_bromoides
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, '×Triticosecale')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, '×Festulpia')
        assert.strictEqual(resource.taxa['T1:1:3'].scientificName, '×Festulpia Festuca rubra×Vulpia bromoides')
    })

    test('parses cross-genus hybrids without parent context', () => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

x Festulpia Festuca_rubra x Vulpia_bromoides
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, '×Festulpia Festuca rubra×Vulpia bromoides')
        assert.strictEqual(resource.taxa['T1:1:1'].verbatimIdentification, '× Festulpia Festuca rubra × Vulpia bromoides')
    })

    test('handles skips in ranks', () => {
        const [resource] = resources.parseTextFile(`---
levels: [family, genus, species]
---

Apidae
    Apis mellifera
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Apis mellifera')
        assert.strictEqual(resource.taxa['T1:1:2'].genus, 'Apis')
        assert.strictEqual(resource.taxa['T1:1:2'].taxonRank, 'species')
    })

    test('parses genera with subgenus-rank synonyms', () => {
        const [resource] = resources.parseTextFile(`---
levels: [genus]
---

Ectemnius Dahlbom
  = Crabro (Ectemnius) Dahlbom
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].taxonRank, 'subgenus')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Ectemnius Dahlbom')
        assert.strictEqual(resource.taxa['T1:1:2'].genericName, 'Crabro')
    })

    test('parses genera with like-name subgenera', () => {
        const [resource] = resources.parseTextFile(`---
levels: [genus, subgenus]
---

Polistes Latreille, 1802
  Polistes Latreille, 1802
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].taxonRank, 'subgenus')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Polistes Latreille, 1802')
        assert.strictEqual(resource.taxa['T1:1:2'].genericName, 'Polistes')
    })

    test('handles clusters', () => {
        const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

Eurydema Laporte, 1833
  oleracea (Linnaeus, 1758)
  [1] rotundicollis (Dohrn, 1860)
  [1] fieberi Schummel, 1837
  [2] ornata (Linnaeus, 1758)
  [2] ventralis Kolenati, 1846
  [_] eckerleini Josifov, 1961
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].dynamicProperties, undefined)
        assert.strictEqual(resource.taxa['T1:1:3'].dynamicProperties, '{"indistinguishableFrom":["T1:1:4"]}')
        assert.strictEqual(resource.taxa['T1:1:4'].dynamicProperties, '{"indistinguishableFrom":["T1:1:3"]}')
        assert.strictEqual(resource.taxa['T1:1:5'].dynamicProperties, '{"indistinguishableFrom":["T1:1:6"]}')
        assert.strictEqual(resource.taxa['T1:1:6'].dynamicProperties, '{"indistinguishableFrom":["T1:1:5"]}')
        assert.strictEqual(resource.taxa['T1:1:7'].dynamicProperties, '{"identifiable":false}')
    })

    suite('leaf taxa checks', () => {
        test('errors for missing leaf taxa', () => {
            assert.throws(() => {
                resources.parseTextFile(`---
levels: [family, genus, species]
---

Cydnidae
Cydnidae
  Legnotus
    limbosus`, 'T1')
            })
        })

        test('does not validate "indet." lines', () => {
            const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

Drymus
  [indet]
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Drymus')
        })

        test('synonyms do not break recognition of missing leaf taxa (1)', () => {
            const [resource] = resources.parseTextFile(`---
levels: [genus, subgenus, species]
---

Bombus
  = Psithyrus
  Bombus
    pascuorum
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:4'].scientificName, 'Bombus pascuorum')
        })

        test('synonyms do not break recognition of missing leaf taxa (2)', () => {
            assert.throws(() => {
            resources.parseTextFile(`---
levels: [genus, subgenus, species]
---

Bombus
  Psithyrus
    = Psithirus
  Bombus
    pascuorum
`, 'T1')
            })
        })

        test('synonyms do not break recognition of missing leaf taxa (3)', () => {
            assert.throws(() => {
                resources.parseTextFile(`---
levels: [family, genus, species]
---

Acanthosomidae
  = Acanthosomatidae
Cydnidae
  Legnotus
    limbosus
`, 'T1')
            })
        })
    })

    suite('corrections', () => {
        test('outputs corrected generic names', () => {
            const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

Bogdania Kerzhner, 1964
  > Bogdiana Kerzhner, 1964
  myrmica Kerzhner, 1964
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Bogdiana Kerzhner, 1964')
            assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Bogdiana myrmica Kerzhner, 1964')
        })

        test('does not validate name with correction', () => {
            const [resource] = resources.parseTextFile(`---
levels: [species]
---

Clytochrysus lapidarius (Panzer, 1804)
  = Crabo chrysostomus Lepeletier & Brullé, 1835
    > Crabro chrysostomus Lepeletier & Brullé, 1835
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Clytochrysus lapidarius (Panzer, 1804)')
        })

        test('parses invalid but corrected name', () => {
            const [resource] = resources.parseTextFile(`---
levels: [species]
---

Crabro Kiesenwetteri A. Morawitz. 1866
  > Crabro kiesenwetteri A. Morawitz. 1866
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Crabro kiesenwetteri A. Morawitz. 1866')
            assert.strictEqual(resource.taxa['T1:1:1'].scientificNameAuthorship, 'A. Morawitz. 1866')
            assert.strictEqual(resource.taxa['T1:1:1'].verbatimIdentification, 'Crabro Kiesenwetteri A. Morawitz. 1866')
        })

        test('parses children of invalid but corrected name', () => {
            const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

Pirus L.
  > Pyrus L.
  aucuparia Gaertn.
  Pirus domestica Sm.
  Pirus aria Ehrh.
    > Pyrus aria Ehrh.
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Pyrus aucuparia Gaertn.')
            assert.strictEqual(resource.taxa['T1:1:3'].scientificName, 'Pyrus domestica Sm.')
            assert.strictEqual(resource.taxa['T1:1:4'].scientificName, 'Pyrus aria Ehrh.')
        })

        test('does not keep parts of invalid but corrected name', () => {
            const [resource] = resources.parseTextFile(`---
levels: [species]
---

Scolia 5-punctata FABRICIUS, 1781
  > Scolia quinquepunctata FABRICIUS, 1781
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Scolia quinquepunctata Fabricius, 1781')
            assert.strictEqual(resource.taxa['T1:1:1'].verbatimIdentification, 'Scolia 5-punctata FABRICIUS, 1781')
        })

        test('make correct diff when last line changes', () => {
            const newText = `---
levels: [species]
---

Bittacus Hageni Brauer
  > Bittacus hageni Brauer
`
            const oldText = `---
levels: [genus, species]
---

Bittacus hageni Brauer
`

            const [resource] = resources.parseTextFile(newText, 'T1', { txt: oldText, dwc: [[null, ['T:1:1'], ['T:1:2']]] })
            assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Bittacus hageni Brauer')
            assert.strictEqual(resource.taxa['T1:1:1'].verbatimIdentification, 'Bittacus Hageni Brauer')
        })

        test('corrections of synonyms are correctly applied', () => {
            const [resource] = resources.parseTextFile(`---
levels: [genus, subgenus, species]
---

Lasius F.
  = Domisthorpea Mor. & Drnt., 1915
    > Donisthorpea Mor. & Drnt., 1915
    fuliginosus Latr.
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Donisthorpea Mor. & Drnt., 1915')
            assert.strictEqual(resource.taxa['T1:1:3'].scientificName, 'Lasius fuliginosus Latr.')
        })

        test('corrections are correctly applied', () => {
            const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

Neopachygaster Austin, 1901
  > Neopachygaster Austen, 1901
  meromelas (Dufour, 1841)
`, 'T1')
            assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Neopachygaster Austen, 1901')
            assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Neopachygaster meromelas (Dufour, 1841)')
        })
    })
})
