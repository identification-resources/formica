#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import { catalog } from '../index'

async function validateFile (arg: string): Promise<WorkError[]> {
    const filePath = path.resolve(arg)
    const file = await fs.readFile(filePath, 'utf8')
    const sheet = path.basename(filePath, '.csv')
    return catalog.loadData(file, sheet).validate()
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
