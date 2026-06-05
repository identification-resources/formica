#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import { catalog } from '../index'

class TaxaValidator {
    taxa: catalog.Entity[];
    errors: WorkError[];
    parentIndex: Record<string, string>;

    constructor (taxa: catalog.Entities) {
        this.taxa = Array.from(taxa).filter(taxon => taxon.has('ancestors_gbif'))
        this.errors = []
        this.parentIndex = {}
    }

    validate (): WorkError[] {
        for (const taxon of this.taxa) {
            const parents = taxon.get('ancestors_gbif') as string[]

            if (parents.length > 1) {
                const id = taxon.get('id') as string

                for (let i = 1; i < parents.length; i++) {
                    this.addToIndex(id, 'ancestors_gbif', parents[i], parents[i - 1])
                }
            }
        }

        for (const taxon of this.taxa) {
            if (taxon.has('gbif')) {
                const id = taxon.get('id') as string
                const parents = taxon.get('ancestors_gbif') as string[]
                const parent = parents[parents.length - 1] as string

                this.addToIndex(id, 'gbif', taxon.get('gbif') as string, parent)
            }
        }

        for (const taxon of this.taxa) {
            if (taxon.has('children_gbif')) {
                const id = taxon.get('id') as string
                const parents = taxon.get('ancestors_gbif') as string[]
                const parent = parents[parents.length - 1] as string

                const childIds = taxon.get('children_gbif') as string[]
                for (const childId of childIds) {
                    this.addToIndex(id, 'gbif', childId, parent)
                }
            }
        }

        return this.errors
    }

    addToIndex (entity: string, field: string, childId: string, parentId: string) {
        const actualParentId = this.parentIndex[childId]

        if (!actualParentId) {
            this.parentIndex[childId] = parentId
        } else if (actualParentId !== parentId) {
            const error = `Inconsistent ancestor of ${childId}, expected ${actualParentId} but got ${parentId}`
            this.errors.push({ entity, field, error })
        }
    }
}

async function validateFile (arg: string): Promise<WorkError[]> {
    const filePath = path.resolve(arg)
    const file = await fs.readFile(filePath, 'utf8')
    const sheet = path.basename(filePath, '.csv')
    const entities = catalog.loadData(file, sheet)
    const errors = entities.validate()

    const ids = new Set()
    for (const entity of entities) {
        const id = entity.get('id') as string

        if (ids.has(id)) {
            errors.push({
                entity: id,
                field: 'id',
                error: `ID "${id}" repeated`
            })
        } else {
            ids.add(id)
        }
    }

    if (sheet === 'taxa') {
        const validator = new TaxaValidator(entities)
        errors.push(...validator.validate())
    }

    return errors
}

async function main (args: string[]): Promise<void> {
    let exitStatus = 0

    const results = await Promise.allSettled(args.map(validateFile))
    for (let i = 0; i < results.length; i++) {
        const result = results[i]

        if (result.status === 'rejected') {
            console.error(`${args[i]}:`)
            console.error(result.reason)
            console.error()
            exitStatus = 1
        } else if (result.value.length > 0) {
            console.error(`${args[i]}:`)
            console.table(result.value)
            console.error()
            exitStatus = 1
        }
    }

    process.exit(exitStatus)
}

main(process.argv.slice(2))
