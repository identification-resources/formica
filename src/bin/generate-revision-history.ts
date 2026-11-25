#!/usr/bin/env node

import * as path from 'path'
import * as util from 'util'

import { numericSort, runCommand } from './util'
import { catalog, csv } from '..'

enum DiffType {
    Added = '+',
    Deleted = '-',
    Modified = '~',
    Unchanged = '='
}

interface EntityDiff {
    id: string,
    commit: string,
    type: DiffType,
    fields?: Record<string, Value|null>
}

interface EntitiesDiff {
    fields: string[],
    commits: Commit[],
    entities: Record<string, EntityDiff[]>
}

interface Commit {
    hash: string,
    timestamp: string,
    message: string,
    author: string
}

async function getGitRoot (file: string): Promise<string> {
    const gitRoot = await runCommand('git', ['rev-parse', '--show-toplevel'], {
        cwd: path.dirname(file)
    })
    return gitRoot.trim()
}

async function listCommits (file: string, gitRoot: string): Promise<Commit[]> {
    const output = await runCommand('git', ['log', '--pretty=format:"%H - %aI - %s - %an"', '--no-patch', '--', file], {
        cwd: gitRoot
    })
    return output.trimEnd().split('\n').map(line => {
        const [hash, timestamp, message, author] = line.slice(1, -1).split(' - ')
        return { hash, timestamp, message, author }
    })
}

async function getFile (file: string, revision: string, gitRoot: string): Promise<string> {
    return await runCommand('git', ['show', revision + ':' + path.relative(gitRoot, file)], { cwd: gitRoot })
}

function fixCatalogFile (file: string): string {
    if (!file.startsWith('id,')) {
        const [header, ...rows] = csv.parseCsv(file)
        header.unshift('id')

        for (let i = 0; i < rows.length; i++) {
            rows[i].unshift(`B${i + 1}`)
        }

        return csv.formatCsv([header, ...rows])
    }

    return file
}

class RevisionProcessor {
    FILE: string;

    constructor (file: string) {
        this.FILE = path.resolve(file)
    }

    async run () {
        const gitRoot = await getGitRoot(this.FILE)
        const commits = await listCommits(this.FILE, gitRoot).then(commits => commits.reverse())

        const diff: EntitiesDiff = {
            fields: [],
            commits,
            entities: {}
        }

        let oldFile = 'id,\n'
        for (const commit of commits) {
            console.error(commit.hash.slice(0, 7), commit.timestamp, commit.message)

            const newFile = await getFile(this.FILE, commit.hash, gitRoot)
            let diffs

            try {
                diffs = this.diffFiles(oldFile, newFile, commit)
            } catch (e) {
                console.error('skipped -', e)
                continue
            }

            for (const entityDiff of diffs) {
                if (!diff.entities[entityDiff.id]) {
                    diff.entities[entityDiff.id] = []
                }
                diff.entities[entityDiff.id].push(entityDiff)
            }

            oldFile = newFile
        }

        diff.fields = csv.parseCsv(oldFile)[0]

        console.log(JSON.stringify(diff))
    }

    diffFiles (oldFile: string, newFile: string, commit: Commit): EntityDiff[] {
        const sheet = path.basename(this.FILE, '.csv')

        if (sheet === 'catalog') {
            oldFile = fixCatalogFile(oldFile)
            newFile = fixCatalogFile(newFile)
        }

        const oldEntities = catalog.loadData(oldFile, sheet)
        const newEntities = catalog.loadData(newFile, sheet)

        const diffs: EntityDiff[] = []
        const ids = [...Object.keys(oldEntities.index), ...Object.keys(newEntities.index)]
            .filter((value, index, array) => array.indexOf(value) === index)
            .sort(numericSort)

        for (const id of ids) {
            if (oldEntities.has(id) && newEntities.has(id)) {
                const diff = this.diffRecord(oldEntities.get(id), newEntities.get(id))
                if (Object.keys(diff).length > 0) {
                    diffs.push({ id, commit: commit.hash, type: DiffType.Modified, fields: diff })
                }
            } else if (newEntities.has(id)) {
                const newEntity = newEntities.get(id)
                const diff = this.diffRecord(new catalog.Entity({}, newEntity.schema), newEntity)
                diffs.push({ id, commit: commit.hash, type: DiffType.Added, fields: diff })
            } else {
                diffs.push({ id, commit: commit.hash, type: DiffType.Deleted })
            }
        }

        return diffs
    }

    diffRecord (oldEntity: catalog.Entity, newEntity: catalog.Entity): Record<string, Value|null> {
        const diff: Record<string, Value|null> = {}

        for (const field in newEntity.schema) {
            if (!oldEntity.has(field) && !newEntity.has(field)) {
                continue
            } else if (oldEntity.has(field) && newEntity.has(field)) {
                const oldValue = oldEntity.get(field)!
                const newValue = newEntity.get(field)!
                if ([oldValue].flat().join('; ') === [newValue].flat().join('; ')) {
                    continue
                }

                diff[field] = newValue
            } else if (oldEntity.has(field)) {
                diff[field] = null
            } else if (newEntity.has(field)) {
                diff[field] = newEntity.get(field)!
            }
        }

        return diff
    }
}

function main (): void {
    const args = util.parseArgs({
        allowPositionals: true
    })

    const processor = new RevisionProcessor(args.positionals[0])
    process.on('exit', () => {
        process.stdout.write('\n')
    })

    processor.run().catch(error => {
        console.error(error)
        process.exit(1)
    })
}

main()
