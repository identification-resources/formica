const test = require('node:test')
const assert = require('assert')

const { catalog, resources } = require('../lib')

test('catalog', async (t) => {
    await t.test('reports missing required fields', (t) => {
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

test('resources', async (t) => {
    await t.test('parses author with initials', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [family, genus, species]
---

    Dolichurus haemorrhous A. Costa, 1886
  Dolichurus A. Costa, 1886
    Dolichurus indet.
Sphecidae A. Costa, 1886
    Sphecidae indet.
`, 'T1')
        assert.deepStrictEqual(Object.values(resource.taxa).map(taxon => taxon.scientificNameAuthorship), Array(3).fill('A. Costa, 1886'))
    })

    await t.test('does not validate name with correction', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Clytochrysus lapidarius (Panzer, 1804)
  = Crabo chrysostomus Lepeletier & Brullé, 1835
    > Crabro chrysostomus Lepeletier & Brullé, 1835
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Clytochrysus lapidarius (Panzer, 1804)')
    })

    await t.test('errors for missing leaf taxa', (t) => {
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

    await t.test('parses synonyms starting with intraspecific ranks', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species]
---

Lygaeus equestris (Linnaeus, 1758)
  = f. lactans Horváth, 1899
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Lygaeus equestris f. lactans Horváth, 1899')
    })

    await t.test('parses accepted taxa starting with intraspecific ranks', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [species, form]
---

Lygaeus equestris (Linnaeus, 1758)
  f. lactans Horváth, 1899
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:2'].scientificName, 'Lygaeus equestris f. lactans Horváth, 1899')
    })

    await t.test('does not validate "indet." lines', (t) => {
        const [resource] = resources.parseTextFile(`---
levels: [genus, species]
---

Drymus
  Unknown sp.
`, 'T1')
        assert.strictEqual(resource.taxa['T1:1:1'].scientificName, 'Drymus')
    })
})
