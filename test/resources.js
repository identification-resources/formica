const test = require('node:test')
const assert = require('assert')

const { resources } = require('../lib')

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
})
