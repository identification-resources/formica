import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Taxon extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            name: { required: true, multiple: false },
            qid: { required: false, multiple: false, format: FORMATS.QID },
            rank: { required: false, multiple: false },
            gbif: { required: false, multiple: false, format: FORMATS.INTEGER },
            children_gbif: { required: false, multiple: true, format: FORMATS.INTEGER },
            ancestors_gbif: { required: false, multiple: true, format: FORMATS.INTEGER }
        })
    }
}
