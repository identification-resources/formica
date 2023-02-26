import { Entities } from './entities'
import { Entity } from './entity'
import { TYPE_INFO } from './tables/index'
import { parseCsv } from '../csv'

function getTypeInfo (type: string): [typeof Entity, string] {
  switch (type) {
    case 'authors': return TYPE_INFO.authors
    case 'places': return TYPE_INFO.places
    case 'publishers': return TYPE_INFO.publishers
    case 'catalog': return TYPE_INFO.catalog
    default: throw new TypeError(`Unknown type "${type}"`)
  }
}

export { Entities, Entity }

export function loadData (file: string, type: string): Entities {
  const [subClass, indexField] = getTypeInfo(type)
  const entities = []
  const [header, ...rows] = parseCsv(file)

  for (const row of rows) {
    const data: Record<string, string> = {}
    for (let index = 0; index < header.length && index < row.length; index++) {
      data[header[index]] = row[index]
    }
    entities.push(new subClass(data, {}))
  }

  return new Entities(entities, indexField)
}
