import { Entity } from '../entity'
import { Author } from './author'
import { Publisher } from './publisher'
import { Place } from './place'
import { Work } from './work'

export const TYPE_INFO: Record<string, [typeof Entity, string]> = {
    authors: [Author, 'name'],
    publishers: [Publisher, 'name'],
    places: [Place, 'name'],
    catalog: [Work, 'id']
}
