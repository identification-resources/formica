import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Taxon extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            name: { required: true, multiple: false },
            id: { required: true, multiple: false, format: FORMATS.TAXON_ID },
            qid: { required: false, multiple: false, format: FORMATS.QID },
            rank: { required: false, multiple: false },
            gbif: { required: false, multiple: false, format: FORMATS.INTEGER },
            children_gbif: { required: false, multiple: true, format: FORMATS.INTEGER },
            ancestors_gbif: { required: false, multiple: true, format: FORMATS.INTEGER },
            duplicate_of: { required: false, multiple: false, format: FORMATS.TAXON_ID }
        })
    }
}
