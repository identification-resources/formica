#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import { catalog } from '../index'

interface TaxaValidatorFields {
    id: string,
    children: string,
    ancestors: string
}

class TaxaValidator {
    taxa: catalog.Entity[];
    fields: TaxaValidatorFields;
    errors: WorkError[];
    parentIndex: Record<string, string>;

    constructor (taxa: catalog.Entities, fields: TaxaValidatorFields) {
        this.taxa = Array.from(taxa).filter(taxon => taxon.has(fields.ancestors))
        this.fields = fields
        this.errors = []
        this.parentIndex = {}
    }

    validate (): WorkError[] {
        for (const taxon of this.taxa) {
            const parents = taxon.get(this.fields.ancestors) as string[]

            if (parents.length > 1) {
                const id = taxon.get('id') as string

                for (let i = 1; i < parents.length; i++) {
                    this.addToIndex(id, this.fields.ancestors, parents[i], parents[i - 1])
                }
            }
        }

        for (const taxon of this.taxa) {
            if (taxon.has(this.fields.id)) {
                const id = taxon.get('id') as string
                const parents = taxon.get(this.fields.ancestors) as string[]
                const parent = parents[parents.length - 1] as string

                this.addToIndex(id, this.fields.id, taxon.get(this.fields.id) as string, parent)
            }
        }

        for (const taxon of this.taxa) {
            if (taxon.has(this.fields.children)) {
                const id = taxon.get('id') as string
                const parents = taxon.get(this.fields.ancestors) as string[]
                const parent = parents[parents.length - 1] as string

                const childIds = taxon.get(this.fields.children) as string[]
                for (const childId of childIds) {
                    this.addToIndex(id, this.fields.id, childId, parent)
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

class GbifTaxaValidator extends TaxaValidator {
    constructor (taxa: catalog.Entities) {
        super(taxa, {
            id: 'gbif',
            children: 'children_gbif',
            ancestors: 'ancestors_gbif'
        })
    }
}

class ColTaxaValidator extends TaxaValidator {
    constructor (taxa: catalog.Entities) {
        super(taxa, {
            id: 'col',
            children: 'children_col',
            ancestors: 'ancestors_col'
        })
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
        // const colValidator = new ColTaxaValidator(entities)
        // errors.push(...colValidator.validate())

        const gbifValidator = new GbifTaxaValidator(entities)
        errors.push(...gbifValidator.validate())
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
