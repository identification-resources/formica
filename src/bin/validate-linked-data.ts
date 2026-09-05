#!/usr/bin/env node

import * as path from 'path'
import { promises as fs } from 'fs'

import N3 from 'n3'
import { Parser as ShapeMapParser, Start as SHAPEMAP_START, Focus as SHAPEMAP_FOCUS } from 'shape-map'
import ShEx from 'shex'
import type { Schema } from 'shexj'
import type { NeighborhoodDb } from '@shexjs/neighborhood-api'
import { ctor as RdfJsDb } from '@shexjs/neighborhood-rdfjs'
import * as ShExParser from '@shexjs/parser'
import type { ShapeMap as StrictShapeMap } from '@shexjs/term'

const SCHEMA_PATH = 'docs/linked-data/shape.shex'
const SHAPEMAP_PATH = 'docs/linked-data/shapeMap.sm'

const BASE = 'https://identification-resources.github.io/assets/data/'
const SCHEMA_BASE = BASE + SCHEMA_PATH
const SHAPEMAP_BASE = BASE + SHAPEMAP_PATH
const DATA_BASE = BASE

async function loadData (path: string): Promise<NeighborhoodDb> {
    const parser = new N3.Parser()
    const file = await fs.readFile(path, 'utf8')
    const data = new N3.Store(parser.parse(file))
    return RdfJsDb(data)
}

async function loadSchema (path: string): Promise<Schema> {
    const parser = ShExParser.construct(SCHEMA_BASE)
    const file = await fs.readFile(path, 'utf8')
    const schema = parser.parse(file, SCHEMA_BASE)
    return schema
}

async function loadShapeMap (path: string): Promise<ShapeMap> {
    const parser = ShapeMapParser.construct(SHAPEMAP_BASE, { base: SCHEMA_BASE }, { base: DATA_BASE })
    const file = await fs.readFile(path, 'utf8')
    const shapeMap = parser.parse(file)
    return shapeMap
}

type ShapeMap = Array<ShapeMapEntry>

interface ShapeMapEntry {
    node: string|TriplePattern
    shape: typeof SHAPEMAP_START|string
}

interface TriplePattern {
    type: 'TriplePattern'
    subject: typeof SHAPEMAP_FOCUS|string|null
    predicate: string|null
    object: typeof SHAPEMAP_FOCUS|string|null
}

function resolveShapeMap (shapeMap: ShapeMap, db: N3.Store): ShapeMap {
    const pairs: ShapeMap = []

    for (const part of shapeMap) {
        if (typeof part.node === 'string') {
            pairs.push(part)
        } else if (part.node.type === 'TriplePattern') {
            const focusSubject = typeof part.node.subject === 'object' && part.node.subject?.term === SHAPEMAP_FOCUS.term
            const subject = typeof part.node.subject === 'string' ? part.node.subject : null
            const object = typeof part.node.object === 'string' ? part.node.object : null
            const quads: N3.Quad[] = db.getQuads(subject, part.node.predicate, object, null)
            for (const quad of quads) {
                pairs.push({
                    node: focusSubject ? quad.subject.id : quad.object.id,
                    shape: part.shape
                })
            }
        } else {
            throw new Error(`Shape map type not supported: "${part.node.type}"`)
        }
    }

    return pairs
}

async function main (args: string[]): Promise<void> {
    const [base, data] = args.map(arg => path.resolve(arg))

    const db = await loadData(data)
    const schema = await loadSchema(path.join(base, SCHEMA_PATH))
    const shapeMap = await loadShapeMap(path.join(base, SHAPEMAP_PATH))
    const nodePairs = resolveShapeMap(shapeMap, db as unknown as N3.Store)

    const validator = new ShEx.Validator(schema, db)
    const results = validator.validateShapeMap(nodePairs as StrictShapeMap)

    let successes = 0

    for (const result of results) {
        if (!result.appinfo.errors) {
            successes++
            continue
        }

        console.error('===', result.node, '===')
        console.error(JSON.stringify(result.appinfo, null, 2))
    }

    console.error(`Success: ${successes}/${nodePairs.length}`)
}

main(process.argv.slice(2))
