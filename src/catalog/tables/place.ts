import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Place extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            name: { required: true, multiple: false },
            id: { required: true, multiple: false, format: FORMATS.PLACE_ID },
            qid: { required: false, multiple: false, format: FORMATS.QID },
            display_name: { required: false, multiple: false },
            duplicate_of: { required: false, multiple: false, format: FORMATS.PLACE_ID }
        })
    }
}
