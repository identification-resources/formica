#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import * as util from 'util'

import { csv } from '../index'
import { prompt, promptForAnswers, numericSort, runCommand } from './util'

const DWC_FIELDS: string[] = [
    'scientificNameID',
    'scientificName',
    'scientificNameAuthorship',
    'genericName',
    'intragenericEpithet',
    'specificEpithet',
    'intraspecificEpithet',

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

    'colTaxonID',
    'gbifTaxonID'
]

const DISPLAY_FIELDS: string[] = [
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

const EXCLUDED_GBIF_RECORDS: string[] = [
    '3230674' // Diptera Borkh. (= Saxifraga L.)
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

async function listChangedFiles (directory: string): Promise<string[]> {
    const output = await runCommand('git', ['diff', '--name-only', 'HEAD', '--', directory], {
        cwd: directory
    })
    return output.trimEnd().split('\n').sort(numericSort)
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

    async run (): Promise<void> {
        const input = await fs.readdir(this.DIR_TXT)
        const output = await fs.readdir(this.DIR_DWC)

        const ids = input
            .map(file => path.basename(file, '.txt'))
            .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))

        for (const id of ids) {
            // Skip existing files
            if (output.some(file => file.startsWith(id + '-'))) {
                continue
            }

            await this.processWork(id)
        }
    }

    async runUpdate (): Promise<void> {
        for (const file of await listChangedFiles(this.DIR_TXT)) {
            const id = path.basename(file, '.txt')
            await this.processWork(id, true)
        }
    }

    async processWork (id: WorkId, update?: boolean): Promise<void> {
        const resources = await this.processResources(id, update)

        await Promise.all(resources.map(resource => {
            const header = DWC_FIELDS
            const table = [header]

            for (const id in resource.taxa) {
                const taxon = resource.taxa[id] as unknown as Record<string, string | undefined>
                table.push(header.map(column => taxon[column] || ''))
            }

            return fs.writeFile(path.join(this.DIR_DWC, `${resource.file}.csv`), csv.formatCsv(table, ',').trim())
        }))
    }

    async processResources (id: WorkId, update?: boolean): Promise<AmendedResource[]> {
        const resources = await this.processResourceText(id, update)

        const amendedResources = []
        for (const resource of resources) {
            const results = await this.processResourceDwc(resource)

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
                            return this.processResources(id, update)
                        }
                    }
                }
            }

            amendedResources.push(results)
        }

        return amendedResources
    }

    async processResourceText (id: WorkId, update?: boolean): Promise<Resource[]> {
        try {
            console.log(`${id}: generating Darwin Core`)
            const filePath = path.join(this.DIR_TXT, id + '.txt')
            const file = await fs.readFile(filePath, 'utf-8')

            let old = undefined
            if (update) {
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

            return this.processResourceText(id, update)
        }
    }

    async processResourceDwc (resource: Resource): Promise<AmendedResource> {
        console.log(`${resource.workId}: matching ${resource.id}`)

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
                } else if (source === 11 && EXCLUDED_GBIF_RECORDS.includes(match.recordId)) {
                    // Excluded GBIF taxa
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

        let amendedResource: AmendedResource = { ...resource, taxa: { ...resource.taxa } }
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

        console.error(`${resource.workId}: source ${source} results in multiple prefixes`)

        let choice
        if (source === '1') {
            console.error(`  Automatically selecting most common prefix...`)
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
            update: {
                type: 'boolean',
                short: 'u'
            }
        },
        allowPositionals: true
    })

    const processor = new ResourceProcessor(args.positionals[0])
    process.on('exit', () => {
        process.stdout.write('\n')
    })

    const task = args.values.update ? processor.runUpdate() : processor.run()
    task.catch(error => {
        console.error(error)
        process.exit(1)
    })
}

main()
