#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import { catalog } from '../index'

type ResourcesIndex = Record<string, ResourceMetadata>

async function loadCatalogFile (file: string, base: string): Promise<catalog.Entities> {
    const contents = await fs.readFile(path.join(base, `${file}.csv`), 'utf8')

    return catalog.loadData(contents, file)
}

async function loadResourcesIndex (base: string): Promise<ResourcesIndex> {
    const contents = await fs.readFile(path.join(base, 'resources', 'index.json'), 'utf8')

    return JSON.parse(contents)
}

function getAll (entity: catalog.Entity, field: string): string[] {
    const value = entity.get(field)

    if (Array.isArray(value)) {
        return value
    } else if (value) {
        return [value]
    } else {
        return []
    }
}

function checkIntegrity (catalog: catalog.Entities, resources: ResourcesIndex, field: string, sheet: catalog.Entities): WorkError[] {
    const errors: WorkError[] = []

    const index: Set<string> = new Set()
    for (const entity of sheet) {
        for (const value of getAll(entity, 'name')) {
            index.add(value)
        }
    }

    for (const entity of catalog) {
        const id = entity.get('id') as string

        for (const value of getAll(entity, field)) {
            if (!index.has(value)) {
                errors.push({
                    entity: id,
                    field: field,
                    error: `Value "${value}" not mapped`
                })
            }
        }
    }

    for (const id in resources) {
        const resource = resources[id]

        if (!resource.catalog || !Object.prototype.hasOwnProperty.call(resource.catalog, field)) {
            continue
        }

        const value = resource.catalog[field]
        const values = Array.isArray(value) ? value : [value]

        for (const value of values) {
            if (!index.has(value)) {
                errors.push({
                    entity: id,
                    field: field,
                    error: `Value "${value}" is not mapped`
                })
            }
        }
    }

    return errors
}

async function main (args: string[]): Promise<void> {
    const base = path.resolve(args[0])

    const [catalog, authors, places, publishers, taxa, resources] = await Promise.all([
        loadCatalogFile('catalog', base),
        loadCatalogFile('authors', base),
        loadCatalogFile('places', base),
        loadCatalogFile('publishers', base),
        loadCatalogFile('taxa', base),
        loadResourcesIndex(base)
    ])

    const errors: WorkError[] = [
        ...checkIntegrity(catalog, resources, 'author', authors),
        ...checkIntegrity(catalog, resources, 'publisher', publishers),
        ...checkIntegrity(catalog, resources, 'taxon', taxa),
        ...checkIntegrity(catalog, resources, 'region', places)
    ]

    console.table(errors)

    process.exit(errors.length ? 1 : 0)
}

main(process.argv.slice(2))
