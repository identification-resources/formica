import { FORMATS } from '../value'
import { Entity } from '../entity'

export class Place extends Entity {
  constructor (values: Record<string, string>) {
    super(values, {
      name: { required: true, multiple: false },
      qid: { required: false, multiple: false, format: FORMATS.QID },
      display_name: { required: false, multiple: false }
    })
  }
}
