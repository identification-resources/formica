import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Publisher extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            name: { required: true, multiple: true },
            id: { required: true, multiple: false, format: FORMATS.PUBLISHER_ID },
            qid: { required: false, multiple: false, format: FORMATS.QID },
            display_name: { required: false, multiple: false },
            full_names: { required: false, multiple: true },
            duplicate_of: { required: false, multiple: false, format: FORMATS.PUBLISHER_ID }
        })
    }
}
