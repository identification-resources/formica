const test = require('node:test')
const assert = require('assert')

const { resources } = require('../lib')

test('resources', async (t) => {
    await t.test('missing leaf taxa', (t) => {
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
