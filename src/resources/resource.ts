import { Work } from '../catalog/tables/work'

export class WorkResource extends Work {
    constructor (values: Record<string, string>) {
        super(values)

        this.schema.version_of.format = /^B[1-9]\d*:[1-9]\d*$/
        this.schema.duplicate_of.format = /^B[1-9]\d*:[1-9]\d*$/
    }
}
