import { promises as fs } from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import * as util from 'util'

import { csv } from '../index'
import { prompt, promptForAnswers, numericSort, runCommand } from './util'

interface AmendedTaxon extends Taxon {
    colTaxonID?: string,
    gbifTaxonID?: string
}

interface AmendedResource extends Resource {
    taxa: Record<TaxonId, AmendedTaxon>
}

type Classifications = Record<string, Array<[AmendedTaxon, string]>>

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

const VALID_COMMON_PREFIXES = [
    'Plantae|Tracheophyta',
    'Fungi',
    'Fungi|Ascomycota',
    'Fungi|Basidiomycota',
    'Fungi|Zygomycota'
]

function runGnverifier (names: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn('gnverifier', ['-s', '1,11', '-M'])
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
            const [results, classifications] = await this.processResourceDwc(resource)

            for (const source in classifications) {
                await this.checkPrefix(resource, classifications, source)
            }

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

    async processResourceDwc (resource: Resource): Promise<[AmendedResource, Classifications]> {
        console.log(`${resource.workId}: matching ${resource.id}`)
        const taxa: Record<string, Record<TaxonId, AmendedTaxon>> = {}
        const names = []
        for (const id in resource.taxa) {
            const name = resource.taxa[id].scientificName

            if (!taxa[name]) { taxa[name] = {} }
            taxa[name][id] = { ...resource.taxa[id] }

            names.push(name)
        }

        const result = await runGnverifier(names.join('\n'))
        const classifications: Classifications = { '1': [], '11': [] }

        const [header, ...matches] = csv.parseCsv(result)
        for (const match of matches) {
            const name = match[header.indexOf('ScientificName')]
            const source = match[header.indexOf('DataSourceId')]
            const id = match[header.indexOf('TaxonId')]
            const classification = match[header.indexOf('ClassificationPath')]

            for (const loirId in taxa[name]) {
                const taxon = taxa[name][loirId]
                if (source === '1' && !taxon.colTaxonID) {
                    taxon.colTaxonID = id
                    classifications[source].push([taxon, classification])
                }
                if (source === '11' && GBIF_RANKS.includes(taxon.taxonRank) && !taxon.gbifTaxonID) {
                    taxon.gbifTaxonID = id
                    classifications[source].push([taxon, classification])
                }
            }
        }

        const results = {
            ...resource,
            taxa: Object.fromEntries(Object.values(resource.taxa).map(taxon => [
                taxon.scientificNameID,
                taxa[taxon.scientificName][taxon.scientificNameID]
            ]))
        }

        return [results, classifications]
    }

    async checkPrefix (resource: AmendedResource, classifications: Classifications, source: string): Promise<void> {
        const lists = classifications[source]
        if (!lists.length) { return }
        const prefix = lists[0][1].split('|')

        for (const [taxon, list] of lists.slice(1)) {
            const parts = list.split('|')
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] !== prefix[i] && i < 3) {
                    let choice

                    if (source === '1' || taxon.taxonomicStatus !== 'accepted') {
                        choice = 'd'
                    } else if (VALID_COMMON_PREFIXES.includes(prefix.slice(0, i).join('|'))) {
                        choice = 'k'
                    } else {
                        console.log(`${resource.workId}: source ${source} results in short prefix "${prefix.slice(0, i).join('|')}" (${i} taxa)`)
                        console.log(`  taxon: ${taxon.scientificNameID} "${taxon.scientificName}"`)
                        console.log(`  class: ${parts.join('|')}`)
                        console.log(`  prefx: ${prefix.join('|')}`)

                        choice = await promptForAnswers(`  Keep or delete (k/d)? `, ['k', 'K', 'd', 'D'])
                    }

                    switch (choice) {
                        case 'k':
                        case 'K': {
                            console.log(`  keeping...`)
                            break
                        }

                        case 'd':
                        case 'D': {
                            console.log(`  deleting...`)
                            if (source === '1') {
                                delete taxon.colTaxonID
                            } else if (source === '11') {
                                delete taxon.gbifTaxonID
                            }
                            break
                        }
                    }

                    break
                }
            }
        }
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
