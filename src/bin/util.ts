import * as readline from 'readline'
import { spawn } from 'child_process'

/**
 * Comparison function to sort strings with numerical components.
 */
export function numericSort (a: string, b: string): number {
    const as = a.split(/(\d+)/)
    const bs = b.split(/(\d+)/)
    for (let i = 0; i < Math.max(as.length, bs.length); i++) {
        const ai = as[i]
        const bi = bs[i]

        if (ai === bi) {
            continue
        } else if (!ai) {
            return 1
        } else if (!bi) {
            return -1
        } else if (i % 2) {
            return parseInt(ai) - parseInt(bi)
        } else {
            return ai > bi ? -1 : 1
        }
    }
    return 0
}

/**
 * Create a CLI prompt and return any answer.
 */
export function prompt (question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    return new Promise(resolve => {
        rl.question(question, (answer: string) => {
            rl.close()
            resolve(answer)
        })
    })
}

/**
 * Create a CLI prompt and only accept certain answers.
 */
export async function promptForAnswers (question: string, answers: string[]) {
    while (true) {
        const answer = (await prompt(question))[0]
        if (answers.includes(answer)) {
            return answer
        }
    }
}

/**
 * Run a command and return stdout.
 */
export function runCommand (command: string, args: string[], options?: Object): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, options)
        let stdout = ''
        let stderr = ''
        proc.stdout.on('data', data => { stdout += data })
        proc.stderr.pipe(process.stdout)
        proc.on('close', code => {
            if (code === 0) {
                resolve(stdout)
            } else {
                reject(new Error(stderr))
            }
        })
    })
}
