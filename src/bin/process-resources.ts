#!/usr/bin/env node

import { promises as fs, existsSync as doesFileExist } from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import * as util from 'util'

import { csv } from '../index'
import { prompt, promptForAnswers, numericSort, runCommand } from './util'

export enum ResourceProcessorSource {
    All = 'all',
    Unprocessed = 'unprocessed',
    Modified = 'modified'
}

const DWC_FIELDS: (keyof AmendedTaxon)[] = [
    'scientificNameID',
    'scientificName',
    'scientificNameAuthorship',
    'genericName',
    'infragenericEpithet',
    'specificEpithet',
    'infraspecificEpithet',

    'taxonRank',
    'taxonRemarks',
    'collectionCode',

    'taxonomicStatus',
    'acceptedNameUsageID',
    'acceptedNameUsage',

    'parentNameUsageID',
    'parentNameUsage',
    'kingdom',
    'phylum',
    'class',
    'order',
    'family',
    'subfamily',
    'genus',
    'subgenus',
    'higherClassification',
    'verbatimIdentification',

    'colTaxonID',
    'gbifTaxonID',
    'colAcceptedTaxonID',
    'gbifAcceptedTaxonID'
]

const DISPLAY_FIELDS: (keyof AmendedTaxon)[] = [
    'scientificNameID',
    'taxonRank',
    'scientificName',
    'taxonomicStatus',
    'taxonRemarks',
    'colTaxonID',
    'gbifTaxonID'
]

const GBIF_RANKS: Rank[] = [
    'kingdom',
    'phyllum',
    'class',
    'order',
    'family',
    'genus',
    'species',
    'subspecies',
    'variety'
]

function runGnverifier (names: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn('gnverifier', ['-s', '1,11', '-f', 'compact', '-M'])
        let stdout = ''
        proc.stdout.on('data', data => { stdout += data })
        proc.stderr.pipe(process.stdout)
        proc.on('close', code => {
            if (code === 0) {
                resolve(stdout)
            } else {
                reject()
            }
        })
        proc.stdin.write(names)
        proc.stdin.end()
    })
}

async function listFiles (directory: string): Promise<string[]> {
    const input = await fs.readdir(directory)
    return input.map(file => path.basename(file, '.txt')).sort(numericSort)
}

async function listUnprocessedFiles (directory: string, outputDirectory: string): Promise<string[]> {
    const input = await listFiles(directory)
    const output = new Set(await fs.readdir(outputDirectory))
    return input.filter(file => output.has(file + '-1'))
}

async function listChangedFiles (directory: string): Promise<string[]> {
    const output = await runCommand('git', ['diff', '--name-only', 'HEAD', '--', directory], {
        cwd: directory
    })
    return output.trimEnd().split('\n').map(file => path.basename(file, '.txt')).sort(numericSort)
}

async function getOldFile (file: string): Promise<string> {
    const options = {
        cwd: path.dirname(file)
    }
    const gitRoot = (await runCommand('git', ['rev-parse', '--show-toplevel'], options)).trim()
    return await runCommand('git', ['show', 'HEAD:' + path.relative(gitRoot, file)], options)
}

class ResourceProcessor {
    DIR_ROOT: string;
    DIR_TXT: string;
    DIR_DWC: string;
    FILE_PROBLEMS: string;

    constructor (collectionPath: string) {
        this.DIR_ROOT = path.resolve(collectionPath)
        this.DIR_TXT = path.join(this.DIR_ROOT, 'txt')
        this.DIR_DWC = path.join(this.DIR_ROOT, 'dwc')
        this.FILE_PROBLEMS = path.join(this.DIR_ROOT, 'problems.csv')
    }

    async run (source: ResourceProcessorSource, config: ResourceProcessorConfig): Promise<void> {
        const ids = await this.listWorks(source)
        for (const id of ids) {
            await this.processWork(id, config)
        }
    }

    async listWorks (source: ResourceProcessorSource): Promise<string[]> {
        switch (source) {
            case ResourceProcessorSource.All:
                return listFiles(this.DIR_TXT)
            case ResourceProcessorSource.Unprocessed:
                return listUnprocessedFiles(this.DIR_TXT, this.DIR_DWC)
            case ResourceProcessorSource.Modified:
                return listChangedFiles(this.DIR_TXT)
            default:
                return []
        }
    }

    async processWork (id: WorkId, config: ResourceProcessorConfig): Promise<void> {
        const resources = await this.processResources(id, config)

        await Promise.all(resources.map(resource => {
            const header = DWC_FIELDS
            const table: string[][] = [header]

            for (const id in resource.taxa) {
                const taxon = resource.taxa[id] as unknown as Record<string, string | undefined>
                table.push(header.map(column => taxon[column] || ''))
            }

            return fs.writeFile(path.join(this.DIR_DWC, `${resource.file}.csv`), csv.formatCsv(table, ',').trim())
        }))
    }

    async processResources (id: WorkId, config: ResourceProcessorConfig): Promise<AmendedResource[]> {
        const resources = await this.processResourceText(id, config)

        const amendedResources = []
        for (const resource of resources) {
            const results = await this.processResourceDwc(resource, config)

            const skip = await this.shouldBeSkipped(resource.id)

            if (!skip) {
                // TODO const correct = checkResults(results, classifications)
                const correct = this.checkResults(results)
                if (!correct) {
                    const choice = await promptForAnswers(
                        `${resource.workId}: problems found in ${resource.id}. Skip or retry (s/r)? `,
                        ['s', 'S', 'r', 'R']
                    )

                    switch (choice) {
                        case 's':
                        case 'S': {
                            const reason = await prompt('Reason for skipping? ')
                            fs.appendFile(this.FILE_PROBLEMS, csv.formatCsv([[
                                resource.workId,
                                resource.id,
                                reason
                            ]]))
                            console.log(`${resource.workId}: skipping ${resource.id}`)
                            break
                        }

                        case 'r':
                        case 'R': {
                            console.log(`${resource.workId}: retrying ${resource.id}`)
                            return this.processResources(id, config)
                        }
                    }
                }
            }

            amendedResources.push(results)
        }

        return amendedResources
    }

    async processResourceText (id: WorkId, config: ResourceProcessorConfig): Promise<Resource[]> {
        try {
            console.log(`${id}: generating Darwin Core`)
            const filePath = path.join(this.DIR_TXT, id + '.txt')
            const file = await fs.readFile(filePath, 'utf-8')

            let old = undefined
            if (config.update) {
                const dwc = []
                for (const file of await fs.readdir(this.DIR_DWC)) {
                    if (file.startsWith(id + '-')) {
                        const filePath = path.join(this.DIR_DWC, file)
                        dwc.push(csv.parseCsv(await getOldFile(filePath)))
                    }
                }

                old = { txt: await getOldFile(filePath), dwc }
            }

            const { resources } = await import('../index')
            return resources.parseTextFile(file, id, old)
        } catch (error) {
            console.log(error)
            await prompt(`${id}: generating Darwin Core failed, retry? `)

            // Clear cache to re-import
            const prefix = path.dirname(require.resolve('../index'))
            for (const file in require.cache) {
                if (file.startsWith(prefix)) {
                    delete require.cache[file]
                }
            }

            return this.processResourceText(id, config)
        }
    }

    async processResourceDwc (resource: Resource, config: ResourceProcessorConfig): Promise<AmendedResource> {
        console.log(`${resource.workId}: matching ${resource.id}`)

        if (!config.updateMappings) {
            const file = path.join(this.DIR_DWC, resource.file + '.csv')
            if (doesFileExist(file)) {
                const [header, ...rows] = csv.parseCsv(await fs.readFile(file, 'utf-8'))
                for (const row of rows) {
                    const oldTaxon = row.reduce((taxon, value, index) => {
                        taxon[header[index]] = value
                        return taxon
                    }, {} as Record<string, string>)
                    const taxon = resource.taxa[oldTaxon.scientificNameID] as AmendedTaxon
                    if (taxon) {
                        taxon.colTaxonID = oldTaxon.colTaxonID
                        taxon.colAcceptedTaxonID = oldTaxon.colAcceptedTaxonID
                        taxon.gbifTaxonID = oldTaxon.gbifTaxonID
                        taxon.gbifAcceptedTaxonID = oldTaxon.gbifAcceptedTaxonID
                    }
                }
            }
            return resource as AmendedResource
        }

        const filteredResults: Record<TaxonId, TaxonMatch[]> = {}
        const taxonNames: Record<string, TaxonId[]> = {}
        const names = new Set()
        for (const id in resource.taxa) {
            const name = resource.taxa[id].scientificName

            if (!taxonNames[name]) { taxonNames[name] = [] }
            taxonNames[name].push(id)

            names.add(name)
            filteredResults[id] = []
        }

        const result = await runGnverifier(Array.from(names).join('\n'))
        for (const results of result.trim().split('\n')) {
            const { name, results: matches } = JSON.parse(results)

            if (!matches) {
                continue
            }

            for (const match of matches) {
                const source = match.dataSourceId
                const currentRank = match.classificationRanks.split('|').pop()

                if (match.scoreDetails.cardinalityScore === 0) {
                    // Rank mismatch
                    continue
                } else if (source === 11 && currentRank === 'species' && match.classificationPath.endsWith(' spec')) {
                    // GBIF species like "Nomada spec"
                    continue
                }

                for (const loirId of taxonNames[name]) {
                    const taxon = resource.taxa[loirId]

                    if (source === 11 && !GBIF_RANKS.includes(taxon.taxonRank)) {
                        // Exclude GBIF matches for ranks that are not in GBIF
                        continue
                    } else if (source === 11 && !match.isSynonym && currentRank !== taxon.taxonRank) {
                        // Exclude matches with rank mismatches (only possible
                        // for non-synonyms).
                        continue
                    }

                    if (!filteredResults[loirId]) {
                        filteredResults[loirId] = []
                    }

                    filteredResults[loirId].push({
                        source,
                        id: match.recordId,
                        currentId: match.currentRecordId,
                        classificationPath: match.classificationPath.split('|')
                    })
                }
            }
        }

        const { taxonNames: { amendResource, groupNameMatches } } = await import('../index')
        const groupedNameMatches = groupNameMatches(filteredResults)

        const amendedResource: AmendedResource = { ...resource, taxa: { ...resource.taxa } }
        for (const source in groupedNameMatches) {
            const matches = await this.selectPrefixes(resource, groupedNameMatches, source)
            amendResource(amendedResource, source, matches)
        }

        return amendedResource
    }

    async selectPrefixes (resource: Resource, groupedNameMatches: GroupedNameMatches, source: string): Promise<Record<TaxonId, TaxonMatch>> {
        const prefixes = Object.keys(groupedNameMatches[source])
        if (prefixes.length === 0) {
            return {}
        } else if (prefixes.length === 1) {
            return groupedNameMatches[source][prefixes[0]]
        }

        // Count total mapped taxa
        const mappedTaxa: Record<TaxonId, boolean> = {}
        for (const prefix of prefixes) {
            for (const taxon in groupedNameMatches[source][prefix]) {
                mappedTaxa[taxon] = true
            }
        }
        const missedTaxonCount = Object.keys(mappedTaxa).length - Object.keys(groupedNameMatches[source][prefixes[0]]).length

        if (missedTaxonCount === 0) {
            // Multiple prefixes but the first one maps all taxa (not counting that are unmapped in all prefixes)
            return groupedNameMatches[source][prefixes[0]]
        }

        console.error(`${resource.workId}: source ${source} results in multiple prefixes`)

        let choice
        if (missedTaxonCount <= 5) {
            console.error(`  Most common prefix misses ${missedTaxonCount} taxa: automatically selecting most common prefix...`)
            choice = '1'
        } else if (source === '1') {
            console.error(`  Catalogue of Life: automatically selecting most common prefix...`)
            choice = '1'
        } else {
            for (let i = 0; i < prefixes.length; i++) {
                const prefix = prefixes[i]
                const taxa = groupedNameMatches[source][prefix]
                const taxonIds = Object.keys(taxa)

                console.error(`  [${i + 1}] ${prefix} (${taxonIds.length} taxa)`)
                for (let j = 0; j < Math.min(9, taxonIds.length); j++) {
                    const taxonId = taxonIds[j]
                    const taxon = resource.taxa[taxonId]
                    const match = taxa[taxonId]
                    console.error(`      taxon: ${taxonId} "${taxon.scientificName}" - ${match.classificationPath.join('|')}`)
                }
                if (taxonIds.length > 9) {
                    console.error(`      ...`)
                }
            }

            do {
                choice = await prompt(`  Select prefixes (1-${prefixes.length})? `)
            } while (!/^(|\d+(,\d+)*)$/.test(choice))
        }

        console.error(`  Applying selection...`)

        if (choice === '') {
            return {}
        }

        const matches: Record<TaxonId, TaxonMatch> = {}
        for (const i of choice.split(',')) {
            const prefix = prefixes[parseInt(i) - 1]
            const taxa = groupedNameMatches[source][prefix]
            for (const id in taxa) {
                if (id in matches) {
                    continue
                }
                matches[id] = taxa[id]
            }
        }

        return matches
    }

    checkResults (resource: AmendedResource): boolean {
        let correct = true
        const missing = []

        for (const id in resource.taxa) {
            const taxon = resource.taxa[id]
            if (taxon.taxonomicStatus !== 'accepted') { continue }

            const missingCol = false // !taxon.colTaxonID
            const missingGbif = GBIF_RANKS.includes(taxon.taxonRank) && !taxon.gbifTaxonID

            if (missingCol || missingGbif) {
                correct = false
                missing.push(taxon)
            }
        }

        if (missing.length) {
            console.table(missing, DISPLAY_FIELDS)
        }

        return correct
    }

    async shouldBeSkipped (id: ResourceId): Promise<boolean> {
        const problems = csv.parseCsv(await fs.readFile(this.FILE_PROBLEMS, 'utf8'))
        return problems.some(([_work, resource, _problem]) => resource === id)
    }
}

function main (): void {
    const args = util.parseArgs({
        options: {
            source: {
                type: 'string',
                short: 's',
                default: 'unprocessed'
            },
            'keep-mappings': {
                type: 'boolean',
                short: 'k'
            }
        },
        allowPositionals: true
    })

    const processor = new ResourceProcessor(args.positionals[0])
    process.on('exit', () => {
        process.stdout.write('\n')
    })

    const source = args.values.source as ResourceProcessorSource
    const config: ResourceProcessorConfig = {
        update: source !== 'unprocessed',
        updateMappings: !args.values['keep-mappings']
    }

    processor.run(source, config).catch(error => {
        console.error(error)
        process.exit(1)
    })
}

main()
