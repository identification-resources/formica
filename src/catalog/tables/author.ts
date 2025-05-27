import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Author extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            name: { required: true, multiple: true },
            id: { required: true, multiple: false, format: FORMATS.AUTHOR_ID },
            qid: { required: false, multiple: false, format: FORMATS.QID },
            display_name: { required: true, multiple: false },
            full_names: { required: false, multiple: true },
            duplicate_of: { required: false, multiple: false, format: FORMATS.AUTHOR_ID }
        })
    }
}
