#!/usr/bin/env node

import { promises as fs } from 'fs'
import * as path from 'path'
import { catalog } from '../index'

async function validateFile (arg: string): Promise<{ filePath: string, errors: WorkError[]}> {
  const filePath = path.resolve(arg)
  const file = await fs.readFile(filePath, 'utf8')
  const sheet = path.basename(filePath, '.csv')
  return {
    filePath,
    errors: catalog.loadData(file, sheet).validate()
  }
}

async function main (args: string[]): Promise<void> {
  let exitStatus = 0

  const results = await Promise.allSettled(args.map(validateFile))
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(result.reason)
      console.error()
      exitStatus = 1
    } else if (result.value.errors.length > 0) {
      console.error(`${result.value.filePath}:`)
      console.table(result.value.errors)
      console.error()
      exitStatus = 1
    }
  }

  process.exit(exitStatus)
}

main(process.argv.slice(2))
