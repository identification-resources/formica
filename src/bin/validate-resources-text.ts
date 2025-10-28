#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import { resources } from '../index'

async function main (args: string[]): Promise<void> {
    let exitStatus = 0

    for (const arg of args) {
        const filePath = path.resolve(arg)
        const file = await fs.readFile(filePath, 'utf8')
        const id = path.basename(filePath, '.txt')
        try {
            resources.parseTextFile(file, id)
        } catch (error) {
            console.error(filePath + '\n' + error.message.replace(/^/gm, '    ') + '\n')
            exitStatus = 1
        }
    }

    process.exit(exitStatus)
}

main(process.argv.slice(2))
