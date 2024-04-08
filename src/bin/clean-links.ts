#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import * as util from 'util'

import { catalog, csv } from '../index'

const LINKS: Record<string, { sheet: string, cleanField: string }> = {
    author: { sheet: 'authors', cleanField: 'main_full_name' },
    publisher: { sheet: 'publishers', cleanField: 'full_name' },
}

function replaceLink (value: string, data: catalog.Entities, cleanField: string): string {
    const entity = data.get(value)
    return entity.get(cleanField) as string ?? value
}

function save (sheet: catalog.Entities, path: string): Promise<void> {
    return fs.writeFile(path, csv.formatCsv(sheet.toTable()))
}

async function main (): Promise<void> {
    const args = util.parseArgs({ allowPositionals: true })

    const files: Record<string, { path: string, sheet: catalog.Entities }> = {}
    for (const arg of args.positionals) {
        const filePath = path.resolve(arg)
        const file = await fs.readFile(filePath, 'utf8')
        const sheet = path.basename(filePath, '.csv')
        files[sheet] = {
            path: filePath,
            sheet: catalog.loadData(file, sheet),
        }
    }

    if (!files.catalog) {
        throw new Error('Catalog file must be provided')
    }

    for (const field in LINKS) {
        const { sheet, cleanField } = LINKS[field]
        const indexField = catalog.getTypeInfo(sheet)[1]
        const used = new Set()

        if (!files[sheet]) {
            continue
        }

        // Update works
        for (const work of files.catalog.sheet.entities) {
            const value = work.get(field)

            if (value === undefined) {
                continue
            } else if (Array.isArray(value)) {
                work.fields[field] = value.map(value => {
                    value = replaceLink(value, files[sheet].sheet, cleanField)
                    used.add(value)
                    return value
                })
            } else {
                work.fields[field] = replaceLink(value, files[sheet].sheet, cleanField)
                used.add(work.fields[field])
            }
        }

        // Filter unused values
        const entities = []
        for (const entity of files[sheet].sheet.entities) {
            const oldKey = entity.get(indexField) as string

            if (entity.has(cleanField)) {
                entity.fields[indexField] = entity.get(cleanField) as Value
                delete entity.fields[cleanField]
            }

            const newKey = entity.get(indexField) as string

            if (used.has(newKey) && (newKey === oldKey || !files[sheet].sheet.index[newKey])) {
                entities.push(entity)
            }
        }

        // Save new file
        await save(new catalog.Entities(entities, indexField), files[sheet].path)
    }

    // Save catalog
    await save(files.catalog.sheet, files.catalog.path)
}

main().catch((error: Error) => {
    console.error(error)
    process.exit(1)
})
