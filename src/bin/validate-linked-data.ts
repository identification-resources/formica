#!/usr/bin/env node

import * as path from 'path'
import { promises as fs } from 'fs'

import N3 from 'n3'
import ShEx from 'shex'

const {
  Parser: ShExParser,
  RdfJsDb,
  ShapeMap,
  Validator: { ShExValidator }
} = ShEx

const SCHEMA_PATH = 'docs/linked-data/shape.shex'
const SHAPEMAP_PATH = 'docs/linked-data/shapeMap.sm'

const BASE = 'https://identification-resources.github.io/assets/data/'
const SCHEMA_BASE = BASE + SCHEMA_PATH
const SHAPEMAP_BASE = BASE + SHAPEMAP_PATH
const DATA_BASE = BASE

async function loadData (path: string): Promise<N3.Store> {
  const parser = new N3.Parser()
  const file = await fs.readFile(path, 'utf8')
  const data = new N3.Store(parser.parse(file))
  return RdfJsDb(data)
}

async function loadSchema (path: string): Promise<any> {
  const parser = ShExParser.construct(SCHEMA_BASE)
  const file = await fs.readFile(path, 'utf8')
  const schema = parser.parse(file, SCHEMA_BASE)
  return schema
}

async function loadShapeMap (path: string): Promise<any> {
  const parser = new ShapeMap.Parser.construct(SHAPEMAP_BASE, { base: SCHEMA_BASE }, { base: DATA_BASE })
  const file = await fs.readFile(path, 'utf8')
  const shapeMap = parser.parse(file)
  return shapeMap
}

function resolveShapeMap (shapeMap: any, db: any): Array<{ node: string, shape: any }> {
  const pairs = []

  for (const part of shapeMap) {
    if (typeof part.node === 'string') {
      pairs.push(part)
    } else if (part.node.type === 'TriplePattern') {
      const focusSubject = typeof part.node.subject === 'object' && part.node.subject?.term === ShapeMap.Focus.term
      const query: Array<string|null> = ['subject', 'predicate', 'object'].map(key => typeof part.node[key] === 'string' ? part.node[key] : null)
      const quads: N3.Quad[] = db.getQuads(...query, null)
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
  const nodePairs = resolveShapeMap(shapeMap, db)

  const validator = new ShExValidator(schema, db)
  const results = validator.validateShapeMap(nodePairs)

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
