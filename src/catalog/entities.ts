import { Entity } from './entity'

export class Entities {
    entities: Entity[];
    indexField: string;
    index: Record<string, Entity>;

    constructor (entities: Entity[], indexField: string) {
        this.entities = entities
        this.indexField = indexField
        this.index = {}
        for (const entity of this.entities) {
            const key = entity.get(indexField)
            if (typeof key !== 'string') {
                throw new TypeError('Entity missing index field')
            }
            this.index[key] = entity
        }
    }

    *[Symbol.iterator] () {
        for (const entity of this.entities) {
            yield entity
        }
    }

    get (key: string): Entity {
        return this.index[key]
    }

    has (key: string): boolean {
        return key in this.index
    }

    validate (): WorkError[] {
        const errors: WorkError[] = []
        for (const entity of this.entities) {
            for (const { field, error } of entity.validate()) {
                errors.push({
                    entity: (entity.get(this.indexField) || '[missing]') as string,
                    field,
                    error
                })
            }
        }
        return errors
    }

    toTable (): string[][] {
        if (this.entities.length === 0) {
            return [[]]
        }
        const header = Object.keys(this.entities[0].schema)
        const table = this.entities.map((entity: Entity) => {
            return header.map((field: string): string => {
                const value = entity.get(field) || ''
                return Array.isArray(value) ? value.join('; ') : value
            })
        })
        return [header, ...table]
    }
}
