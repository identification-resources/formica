import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Publisher extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            name: { required: true, multiple: false },
            qid: { required: false, multiple: false, format: FORMATS.QID },
            full_name: { required: false, multiple: false },
            long_name: { required: false, multiple: true }
        })
    }
}
