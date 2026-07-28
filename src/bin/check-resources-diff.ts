#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import * as util from 'util'

import { csv } from '../index'
import { runCommand } from './util'

async function listChangedFiles (directory: string): Promise<string[]> {
    const output = await runCommand('git', ['diff', '--name-only', 'HEAD', '--', directory], {
        cwd: directory
    })
    return output.trimEnd().split('\n')
}

async function getOldFile (file: string, gitRoot: string): Promise<string> {
    return runCommand('git', ['show', 'HEAD:' + path.relative(gitRoot, file)], {
        cwd: path.dirname(file)
    })
}

async function main (): Promise<void> {
    const args = util.parseArgs({
        allowPositionals: true
    })

    const base = path.resolve(args.positionals[0])
    const files = await listChangedFiles(base)
    const gitRoot = (await runCommand('git', ['rev-parse', '--show-toplevel'], {
        cwd: args.positionals[0]
    })).trim()

    const columnIndex: Record<string, Set<string>> = {}

    for (const fileName of files) {
        const filePath = path.join(gitRoot, fileName)
        const b = csv.parseCsv(await fs.readFile(filePath, 'utf8'))
        const a = csv.parseCsv(await getOldFile(filePath, gitRoot))
        const header = a[0]

        for (let i = 1; i < Math.max(a.length, b.length); i++) {
            for (let j = 0; j < header.length; j++) {
                if (!a[i] || !b[i] || a[i][j] !== b[i][j]) {
                    (columnIndex[header[j]] ?? (columnIndex[header[j]] = new Set())).add(path.basename(fileName, '.csv'))
                }
            }
        }
    }

    const output = Object.entries(columnIndex)
        .sort((a, b) => b[1].size - a[1].size)
        .map(([column, files]) => ({
            column,
            count: files.size,
            files: (files.size > 10 ? [...files].slice(0, 10).concat('...') : [...files]).join(', ')
        }))

    console.table(output)
}

main().catch(console.error)
