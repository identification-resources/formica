#!/usr/bin/env node

import { promises as fs, existsSync as doesFileExist } from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import * as util from 'util'

import { csv } from '../index'
import { prompt, promptForAnswers, numericSort, runCommand } from './util'

export enum ResourceTaxonIdSource {
    COL = 'col',
    GBIF = 'gbif'
}

export enum ResourceProcessorSource {
    All = 'all',
    Unprocessed = 'unprocessed',
    Modified = 'modified',
    Dwc = 'dwc'
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

    'dynamicProperties',

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

const GNVERIFIER_SOURCES: Record<ResourceTaxonIdSource, number> = {
    gbif: 11,
    col: 13
}

function runGnverifier (names: string, sources: ResourceTaxonIdSource[]): Promise<string> {
    const sourceArg = sources.map(source => GNVERIFIER_SOURCES[source]).join()

    return new Promise((resolve, reject) => {
        const proc = spawn('gnverifier', ['-s', sourceArg, '-f', 'compact', '-M'])
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
    return input.filter(file => !output.has(file + '-1.csv'))
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
        if (source === ResourceProcessorSource.Dwc) {
            return this.runDwc(config)
        }

        const ids = await this.listWorks(source)
        for (const id of ids) {
            await this.processWork(id, config)
        }
    }

    async runDwc (config: ResourceProcessorConfig): Promise<void> {
        const files = await fs.readdir(this.DIR_DWC)
        files.sort(numericSort)

        for (const file of files) {
            const [workId, index] = path.basename(file, '.csv').split('-')
            const resource: AmendedResource = {
                id: `${workId}:${index}`,
                file: `${workId}-${index}`,
                workId,
                metadata: { levels: [] },
                taxa: {}
            }

            const filePath = path.join(this.DIR_DWC, file)
            const [header, ...rows] = csv.parseCsv(await fs.readFile(filePath, 'utf-8'))
            for (const row of rows) {
                const taxon = Object.fromEntries(header.map((h, i) => [h, row[i]]))
                resource.taxa[taxon.scientificNameID] = taxon as unknown as Taxon
            }

            await this.processResourceDwc(resource, config)
            await this.writeResourceDwc(resource)
        }
    }

    async listWorks (source: ResourceProcessorSource): Promise<string[]> {
        switch (source) {
            case ResourceProcessorSource.All:
            case ResourceProcessorSource.Dwc:
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

        await Promise.all(resources.map(resource => this.writeResourceDwc(resource)))
    }

    async writeResourceDwc (resource: AmendedResource): Promise<void> {
        const header = DWC_FIELDS
        const table: string[][] = [header]

        for (const id in resource.taxa) {
            const taxon = resource.taxa[id] as unknown as Record<string, string | undefined>
            table.push(header.map(column => taxon[column] || ''))
        }

        return fs.writeFile(path.join(this.DIR_DWC, `${resource.file}.csv`), csv.formatCsv(table, ',').trim())
    }

    async processResources (id: WorkId, config: ResourceProcessorConfig): Promise<AmendedResource[]> {
        const resources = await this.processResourceText(id, config)

        const amendedResources = []
        for (const resource of resources) {
            const results = await this.processResourceDwc(resource, config)

            const skip = await this.shouldBeSkipped(resource.id)

            if (!skip) {
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
                old = {
                    txt: await getOldFile(filePath),
                    dwc: await this.readResourceDwc(id)
                }
            }

            const { resources } = await import('../index')
            return resources.parseTextFile(file, id, old)
        } catch (error) {
            if (error instanceof Error) {
                console.log(error.message)
            }

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

    async readResourceDwc (id: WorkId): Promise<Array<string[][]>> {
        const dwc = []

        for (const file of await fs.readdir(this.DIR_DWC)) {
            if (file.startsWith(id + '-')) {
                const filePath = path.join(this.DIR_DWC, file)
                dwc.push(csv.parseCsv(await getOldFile(filePath)))
            }
        }

        return dwc
    }

    async processResourceDwc (resource: Resource|AmendedResource, config: ResourceProcessorConfig): Promise<AmendedResource> {
        console.log(`${resource.workId}: matching ${resource.id}`)

        // If not all mappings will be rerun and the mappings are not already provided,
        // read the existing DwC files and add the corresponding mappings.
        const hasMappings = Object.values(resource.taxa).some(taxon => 'gbifAcceptedTaxonID' in taxon || 'colAcceptedTaxonID' in taxon)
        if (!hasMappings && config.updateMappings.length < 2) {
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
        }

        if (config.updateMappings.length === 0) {
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

        const result = await runGnverifier(Array.from(names).join('\n'), config.updateMappings)
        for (const results of result.trim().split('\n')) {
            interface MatchScoreDetails {
                cardinalityScore: number;
            }

            interface Match {
                currentRecordId: string;
                dataSourceId: number;
                matchedName: string;
                recordId: string;
                sortScore: number;
                isSynonym: boolean;
                classificationPath: string;
                classificationRanks: string;
                scoreDetails: MatchScoreDetails;
            }

            const { name, results: matches } = JSON.parse(results)

            if (!matches) {
                continue
            }

            // Fix author scoring for some species, see https://github.com/gnames/gnverifier/issues/129
            matches.sort((a: Match, b: Match) => {
                if (a.sortScore !== b.sortScore) {
                    return b.sortScore - a.sortScore
                }

                return name === a.matchedName ? -1 : name === b.matchedName ? 1 : 0
            })

            for (const match of matches as Match[]) {
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

                    // https://github.com/gnames/gnverifier/issues/156
                    if (source === 1 || source === 13 && match.recordId !== match.currentRecordId) {
                        const [a, b, c] = match.recordId.split('|')
                        if (b && c) {
                            if (a !== c || b !== match.currentRecordId) {
                                throw new Error(`Unexpected recordId format ${match.recordId}`)
                            }

                            match.recordId = a
                        }
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
            },
            'update-mappings': {
                type: 'string',
                short: 'u',
                multiple: true
            }
        },
        allowPositionals: true
    })

    if (!Object.values(ResourceProcessorSource).includes(args.values.source as ResourceProcessorSource)) {
        throw new Error(`Unknown argument "--source ${args.values.source}"`)
    }

    const mappingSources = Object.values(ResourceTaxonIdSource)

    let updateMappings = mappingSources
    if (args.values['keep-mappings']) {
        if (args.values['update-mappings']) {
            throw new Error('Cannot provide both --keep-mappings (-k) and --update-mappings (-u)')
        }

        updateMappings = [] as ResourceTaxonIdSource[]
    } else if (args.values['update-mappings']) {
        for (const source of args.values['update-mappings']) {
            if (!mappingSources.includes(source as ResourceTaxonIdSource)) {
                throw new Error(`Unknown argument "--update-mappings ${args.values.source}"`)
            }
        }

        updateMappings = args.values['update-mappings'] as ResourceTaxonIdSource[]
    }

    const processor = new ResourceProcessor(args.positionals[0])
    process.on('exit', () => {
        process.stdout.write('\n')
    })

    const source = args.values.source as ResourceProcessorSource
    const config: ResourceProcessorConfig = {
        update: source === ResourceProcessorSource.All || source === ResourceProcessorSource.Modified,
        updateMappings
    }

    processor.run(source, config).catch(error => {
        console.error(error)
        process.exit(1)
    })
}

main()
