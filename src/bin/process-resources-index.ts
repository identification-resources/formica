#!/usr/bin/env node

import { promises as fs, existsSync as fileExists } from 'fs'
import * as path from 'path'

import { csv, resources } from '../index'
import { numericSort } from './util'

interface AmendedResourceMetadata extends ResourceMetadata {
    id: ResourceId,
    taxonCount: number
}

type SortObjectCallback = (a: string, b: string) => number
function alphabeticSort (a: string, b: string): number {
    return a > b ? 1 : a < b ? -1 : 0
}

function sortObject (object: Record<string, unknown>, sorter?: SortObjectCallback): Record<string, unknown> {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(object).sort(sorter ?? numericSort)) {
        sorted[key] = object[key]
    }
    return sorted
}

function addTaxon (index: Record<string, TaxonId[]>, id: string, taxon: string[]) {
    if (!(id in index)) {
        index[id] = []
    }
    index[id].push(taxon[0])
    index[id].sort(numericSort)
}

async function main (args: string[]): Promise<void> {
    const REPO_ROOT = path.resolve(args[0])

    const files = await fs.readdir(path.join(REPO_ROOT, 'txt'))

    const gbifIndex: Record<string, TaxonId[]> = {}
    const colIndex: Record<string, TaxonId[]> = {}
    const resourceIndex: Record<ResourceId, AmendedResourceMetadata> = {}

    await Promise.all(files.map(async function (fileName) {
        if (!fileName.endsWith('.txt')) { return }
        const id = fileName.slice(0, -4)
        const file = await fs.readFile(path.join(REPO_ROOT, 'txt', fileName), 'utf-8')

        return Promise.all(resources.parseTextFileHeader(file).map(async function (resource, index) {
            const amendedResource = {
                ...resource,
                id: `${id}:${index + 1}`,
                taxonCount: 0
            }

            const dwcFile = path.join(REPO_ROOT, 'dwc', `${id}-${index + 1}.csv`)
            if (!fileExists(dwcFile)) {
                return
            }

            const [header, ...dwc] = csv.parseCsv(await fs.readFile(dwcFile, 'utf-8'))
            const gbifColumn = header.indexOf('gbifTaxonID')
            const gbifAcceptedColumn = header.indexOf('gbifAcceptedTaxonID')
            const colColumn = header.indexOf('colTaxonID')
            const colAcceptedColumn = header.indexOf('colAcceptedTaxonID')
            for (const taxon of dwc) {
                const gbifId = taxon[gbifColumn]
                if (gbifId) {
                    addTaxon(gbifIndex, gbifId, taxon)
                    if (taxon[gbifAcceptedColumn] !== taxon[gbifColumn]) {
                        addTaxon(gbifIndex, taxon[gbifAcceptedColumn], taxon)
                    }
                }

                const colId = taxon[colColumn]
                if (colId) {
                    addTaxon(colIndex, colId, taxon)
                    if (taxon[colAcceptedColumn] !== taxon[colColumn]) {
                        addTaxon(colIndex, taxon[colAcceptedColumn], taxon)
                    }
                }

                amendedResource.taxonCount += 1
            }

            resourceIndex[amendedResource.id] = amendedResource
        }))
    }))

    await Promise.all([
        fs.writeFile(path.join(REPO_ROOT, 'gbif.index.json'), JSON.stringify(sortObject(gbifIndex), null, 2)),
        fs.writeFile(path.join(REPO_ROOT, 'col.index.json'), JSON.stringify(sortObject(colIndex, alphabeticSort), null, 2)),
        fs.writeFile(path.join(REPO_ROOT, 'index.json'), JSON.stringify(sortObject(resourceIndex), null, 2))
    ])
}

main(process.argv.slice(2)).catch(error => {
    console.error(error)
    process.exit(1)
})
