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

function addTaxon (index: Record<string, TaxonId[]>, id: string, taxonId: TaxonId) {
    if (!(id in index)) {
        index[id] = []
    }
    index[id].push(taxonId)
    index[id].sort(numericSort)
}

async function main (args: string[]): Promise<void> {
    const REPO_ROOT = path.resolve(args[0])
    const COLUMNS = ['scientificNameID', 'gbifTaxonID', 'gbifAcceptedTaxonID', 'colTaxonID', 'colAcceptedTaxonID', 'dynamicProperties']

    const files = await fs.readdir(path.join(REPO_ROOT, 'txt'))

    const gbifIndex: Record<string, TaxonId[]> = {}
    const colIndex: Record<string, TaxonId[]> = {}
    const resourceIndex: Record<ResourceId, AmendedResourceMetadata> = {}

    const taxa: Record<ResourceId, Array<Partial<AmendedTaxon>>> = {}

    await Promise.all(files.map(async function (fileName) {
        if (!fileName.endsWith('.txt')) { return }
        const id = fileName.slice(0, -4)
        const file = await fs.readFile(path.join(REPO_ROOT, 'txt', fileName), 'utf-8')

        return Promise.all(resources.parseTextFileHeader(file).map(async function (resource, index) {
            const resourceId = `${id}:${index + 1}`
            const amendedResource = { ...resource, id: resourceId, taxonCount: 0 }

            const dwcFile = path.join(REPO_ROOT, 'dwc', `${id}-${index + 1}.csv`)
            if (!fileExists(dwcFile)) {
                return
            }

            const [header, ...dwc] = csv.parseCsv(await fs.readFile(dwcFile, 'utf-8'))
            const columnIndices = COLUMNS.map(column => header.indexOf(column))
            taxa[resourceId] = dwc.map(row => Object.fromEntries(columnIndices.map((index, i) => [COLUMNS[i], row[index]])))

            amendedResource.taxonCount = taxa[resourceId].length

            resourceIndex[amendedResource.id] = amendedResource
        }))
    }))

    function getPairs (resource: ResourceId): Array<[Record<string, TaxonId[]>, string, TaxonId]> {
        const pairs: Array<[Record<string, TaxonId[]>, string, TaxonId]> = []
        const { includes = [] } = resourceIndex[resource]
        const unusedIncludes = new Set(includes)

        for (const taxon of taxa[resource]) {
            if (taxon.gbifTaxonID) {
                pairs.push([gbifIndex, taxon.gbifTaxonID, taxon.scientificNameID as string])
            }
            if (taxon.gbifAcceptedTaxonID && taxon.gbifAcceptedTaxonID !== taxon.gbifTaxonID) {
                pairs.push([gbifIndex, taxon.gbifAcceptedTaxonID, taxon.scientificNameID as string])
            }

            if (taxon.colTaxonID) {
                pairs.push([colIndex, taxon.colTaxonID, taxon.scientificNameID as string])
            }
            if (taxon.colAcceptedTaxonID && taxon.colAcceptedTaxonID !== taxon.colTaxonID) {
                pairs.push([colIndex, taxon.colAcceptedTaxonID, taxon.scientificNameID as string])
            }

            const { continuesIn = [] } = JSON.parse(taxon.dynamicProperties || '{}')
            for (const include of continuesIn) {
                if (includes.includes(include)) {
                    unusedIncludes.delete(include)

                    for (const [index, indexId, taxonId] of getPairs(include)) {
                        pairs.push([index, indexId, taxon.scientificNameID + '-' + taxonId])
                    }
                }
            }
        }

        for (const include of unusedIncludes) {
            for (const [index, indexId, taxonId] of getPairs(include)) {
                pairs.push([index, indexId, resource + '-' + taxonId])
            }
        }

        return pairs
    }

    for (const id in resourceIndex) {
        for (const [index, indexId, taxonId] of getPairs(id)) {
            addTaxon(index, indexId, taxonId)
        }
    }

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
