const { suite, test } = require('node:test')
const assert = require('assert')

const { catalog, resources } = require('../lib')

suite('catalog', async (t) => {
    await test('reports missing required fields', (t) => {
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

suite('resources', async (t) => {
    await test('parses author with initials', (t) => {
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

    await test('does not validate name with correction', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Clytochrysus lapidarius (Panzer, 1804)
  = Crabo chrysostomus Lepeletier & Brullé, 1835
    > Crabro chrysostomus Lepeletier & Brullé, 1835
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Clytochrysus lapidarius (Panzer, 1804)')
    })

    await test('errors for missing leaf taxa', (t) => {
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

    await test('parses synonyms starting with intraspecific ranks', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Lygaeus equestris (Linnaeus, 1758)
  = f. lactans Horváth, 1899
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Lygaeus equestris f. lactans Horváth, 1899')
    })

    await test('parses accepted taxa starting with intraspecific ranks', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species, form]
---

Lygaeus equestris (Linnaeus, 1758)
  f. lactans Horváth, 1899
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Lygaeus equestris f. lactans Horváth, 1899')
    })

    await test('does not validate "indet." lines', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

Drymus
  [indet]
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Drymus')
    })

    await test('parses names containing non-ASCII characters', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Nematus fåhraei Thomson
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Nematus fåhraei Thomson')
    })

    await test('parses synonyms in different genera', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Katamenes arbustorum subsp. burlinii
  > arbustorum subsp. burlinii
  = Eumenes arbustorum var. burlinii
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Eumenes arbustorum var. burlinii')
    })

    await test('parses species without generic names', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [genus, subgenus, species]
---

Microdynerus Thomson, 1874
  Alastorynerus Blüthgen, 1938
    microdynerus (Dalla Torre, 1889)
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:3'].scientificName, 'Microdynerus microdynerus (Dalla Torre, 1889)')
    })

    await test('parses hybrids', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Rumex conglomeratus x maritimus
Tilia x vulgaris
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Rumex conglomeratus×maritimus')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Tilia ×vulgaris')
    })

    await test('outputs corrected generic names', (t) => {
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

    await test('parses cross-genus hybrids', (t) => {
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

    await test('parses cross-genus hybrids without parent context', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

x Festulpia Festuca_rubra x Vulpia_bromoides
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, '×Festulpia Festuca rubra×Vulpia bromoides')
        assert.strictEqual(resource.taxa['T1:1:1'].verbatimIdentification, '× Festulpia Festuca rubra × Vulpia bromoides')
    })

    await test('handles skips in ranks', (t) => {
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

    await test('synonyms do not break recognition of missing leaf taxa (1)', (t) => {
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

    await test('synonyms do not break recognition of missing leaf taxa (2)', (t) => {
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

    await test('synonyms do not break recognition of missing leaf taxa (3)', (t) => {
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

    await test('parses genera with subgenus-rank synonyms', (t) => {
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

    await test('parses genera with like-name subgenera', (t) => {
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

    await test('parses invalid but corrected name', (t) => {
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

    await test('parses children of invalid but corrected name', (t) => {
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

    await test('does not keep parts of invalid but corrected name', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Scolia 5-punctata FABRICIUS, 1781
  > Scolia quinquepunctata FABRICIUS, 1781
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Scolia quinquepunctata Fabricius, 1781')
        assert.strictEqual(resource.taxa['T1:1:1'].verbatimIdentification, 'Scolia 5-punctata FABRICIUS, 1781')
    })

    await test('make correct diff when last line changes', (t) => {
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
})
