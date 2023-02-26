export function parseCsv (file: string) {
  const values = file
    .trim()
    .match(/("([^"]|"")*?"|[^,\n]+|(?!$))(,|\n|$)/g)

  if (values === null) {
    throw new TypeError('Failed to parse csv')
  }

  return values.reduce((rows, value) => {
    const last: string[] = rows[rows.length - 1]
    if (value.endsWith('\n')) {
      rows.push([])
    }
    value = value.replace(/[,\n]$/, '')
    last.push(value.startsWith('"') ? value.replace(/""/g, '"').slice(1, -1) : value)
    return rows
  }, [[]])
}

export function formatCsv (table: string[][]) {
  return table
    .map((row: string[]) => {
      return row.map(value => {
          if (/["\n,]/.test(value)) {
            return `"${value.replace(/"/, '"""')}"`
          } else {
            return value
          }
        })
        .join(',')
    })
    .join('\n')
}
