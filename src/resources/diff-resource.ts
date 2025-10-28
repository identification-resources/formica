export enum ResourceDiffType {
    Added = '+',
    Deleted = '-',
    Modified = '~',
    Unchanged = '='
}

interface DiffPart {
    text: string,
    type: ResourceDiffType
}

class Matrix {
    values: Array<number>
    m: number
    n: number

    constructor (m: number, n: number) {
        this.values = Array(m * n).fill(0)
        this.m = m
        this.n = n
    }

    getValue (i: number, j: number) {
        return this.values[(i * this.n) + j]
    }

    setValue (i: number, j: number, value: number) {
        this.values[(i * this.n) + j] = value
    }
}

function LCS (X: string[], Y: string[]): DiffPart[] {
    const m = X.length
    const n = Y.length

    // Build matrix
    const C = new Matrix(m + 1, n + 1)
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (X[i] === Y[j]) {
                C.setValue(i + 1, j + 1, C.getValue(i, j) + 1)
            } else {
                C.setValue(i + 1, j + 1, Math.max(C.getValue(i, j + 1), C.getValue(i + 1, j)))
            }
        }
    }

    // Backtrace
    const diff = []
    let i = m
    let j = n
    while (i + j !== 0) {
        if (X[i - 1] === Y[j - 1]) {
            diff.unshift({
                text: X[i - 1],
                type: ResourceDiffType.Unchanged
            })
            i--
            j--
        } else if (i !== 0 && (j === 0 || C.getValue(i - 1, j) > C.getValue(i, j - 1))) {
            diff.unshift({
                text: X[i - 1],
                type: ResourceDiffType.Added
            })
            i--
        } else {
            diff.unshift({
                text: Y[j - 1],
                type: ResourceDiffType.Deleted
            })
            j--
        }
    }

    return diff
}

function tokenizeWords (text: string): string[] {
    if (text.length === 0) {
        return []
    }
    return text.match(/\S+|\n|[\r\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g) as string[]
}

function tokenizeLines (text: string): string[] {
    return text.split('\n')
}

function diffTokens (X: string[], Y: string[]): ResourceDiff {
    // Remove common prefix
    const prefix = []
    while (X.length && X[0] === Y[0]) {
        prefix.push({
            text: X[0],
            type: ResourceDiffType.Unchanged
        })
        X.shift()
        Y.shift()
    }

    // Remove common suffix
    const suffix = []
    while (X.length && X[X.length - 1] === Y[Y.length - 1]) {
        suffix.unshift({
            text: X[X.length - 1],
            type: ResourceDiffType.Unchanged
        })
        X.pop()
        Y.pop()
    }

    // Generate diff from remains, combine with prefix and suffix
    return [
        ...prefix,
        ...LCS(X, Y),
        ...suffix
    ]
}

function convertWordDiff (changes: ResourceDiff): ResourceDiff {
    const lines: ResourceDiff = []
    let line: ResourceDiffPart|null = null
    let deletedNewlines = 0
    let nextLineNew = false

    for (const change of changes) {
        // Start of line
        if (line === null) {
            deletedNewlines = 0
            line = { type: change.type }
        }

        // End of line (could be same token)
        if (change.text === '\n') {
            if (change.type === ResourceDiffType.Deleted) {
                // Keep track of deleted newlines. These indicate the merging of
                // lines. To keep the taxon identifiers consistent, it is
                // important that deleted taxa are tracked.
                deletedNewlines++
                continue
            }

            // If there is a new newline, there is a new... line. If the current
            // line is not seen as new, the next one should be marked as new.
            if (nextLineNew) {
                line.type = ResourceDiffType.Added
                nextLineNew = false
            }
            if (change.type === ResourceDiffType.Added && line.type !== ResourceDiffType.Added) {
                nextLineNew = true
            }

            // Line ended
            lines.push(line)
            line = null

            // Add placeholders for deleted lines
            while (deletedNewlines--) {
                lines.push({
                    text: undefined,
                    original: '',
                    type: ResourceDiffType.Deleted
                })
            }

            continue
        }

        // Added/Deleted/Unchanged on the same line -> line is modified but did
        // already exist.
        if (change.type !== line.type) {
            line.type = ResourceDiffType.Modified
        }

        if (change.type !== ResourceDiffType.Deleted) {
            line.text = (line.text ?? '') + change.text
        }

        if (change.type !== ResourceDiffType.Added) {
            line.original = (line.original ?? '') + change.text
        }
    }

    return lines
}

function getWordTokensFromLines (lines: ResourceDiff): string[] {
    return lines.flatMap(change => tokenizeWords(change.text as string).concat('\n'))
}

type MultilineDiffPart = { added: ResourceDiff, deleted: ResourceDiff }

function mergeDiffPart (diffPart: MultilineDiffPart): ResourceDiff {
    if (diffPart.added.length && diffPart.deleted.length) {
        return convertWordDiff(diffTokens(getWordTokensFromLines(diffPart.added), getWordTokensFromLines(diffPart.deleted)))
    } else if (diffPart.added.length) {
        return diffPart.added
    } else if (diffPart.deleted.length) {
        return diffPart.deleted.map(change => ({ text: undefined, original: change.text, type: change.type }))
    } else {
        return []
    }
}

export function createDiff (a: string, b: string): ResourceDiff {
    const lines: ResourceDiff = diffTokens(tokenizeLines(a.trimEnd()), tokenizeLines(b.trimEnd()))

    const changes: ResourceDiff = []
    const diffPart: MultilineDiffPart = { added: [], deleted: [] }
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].type === ResourceDiffType.Added) {
            diffPart.added.push(lines[i])
        } else if (lines[i].type === ResourceDiffType.Deleted) {
            diffPart.deleted.push(lines[i])
        } else {
            changes.push(...mergeDiffPart(diffPart), lines[i])
            diffPart.added.length = 0
            diffPart.deleted.length = 0
        }
    }

    changes.push(...mergeDiffPart(diffPart))

    return changes
}
