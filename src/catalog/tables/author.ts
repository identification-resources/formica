import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Author extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            name: { required: true, multiple: false },
            qid: { required: false, multiple: false, format: FORMATS.QID },
            main_full_name: { required: false, multiple: false },
            full_names: { required: false, multiple: true }
        })
    }
}
