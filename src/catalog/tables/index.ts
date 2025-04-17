import { Entity } from '../entity'
import { Author } from './author'
import { Publisher } from './publisher'
import { Place } from './place'
import { Taxon } from './taxon'
import { Work } from './work'

export const TYPE_INFO: Record<string, [typeof Entity, string]> = {
    authors: [Author, 'id'],
    publishers: [Publisher, 'id'],
    places: [Place, 'id'],
    taxa: [Taxon, 'id'],
    catalog: [Work, 'id']
}
