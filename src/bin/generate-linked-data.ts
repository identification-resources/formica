#!/usr/bin/env node

import { existsSync as doesFileExist, promises as fs } from 'fs'
import * as path from 'path'
import * as util from 'util'

import type { JsonLdDocument, NodeObject } from 'jsonld'
import * as jsonld from 'jsonld'
import * as N3 from 'n3'

import { catalog } from '../index'
import { WorkResource } from '../resources/resource'
import { parseCsv } from '../csv'

const SHEETS = ['catalog', 'authors', 'places', 'publishers', 'taxa'] as const

interface Resource {
    metadata: ResourceMetadata,
    taxa: AmendedTaxon[],
}

interface Catalog {
    catalog: catalog.Entities,
    authors: catalog.Entities,
    places: catalog.Entities,
    publishers: catalog.Entities,
    taxa: catalog.Entities,

    resources: Record<ResourceId, Resource>,
}

const PREFIX = 'https://purl.org/identification-resources/'
const HANDLE_PREFIX = 'https://hdl.handle.net/'
const SCOPES: Record<string, [string, string]> = {
    // animal life stage
    'adults': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/adult'],
    'pupae': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/pupa'],
    'juveniles': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/juvenile'],
    'subimagos': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/juvenile'],
    'larvae': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'larvae (instar V)': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'larvae (instar IV)': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'larvae (instar III)': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'larvae (instar I)': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'nymphs': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'nypmhs': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'nymphs (instar V)': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'nymphs (instar IV)': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/larva'],
    'eggs': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/embryo'],

    // plant life stage
    'flowering plants': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/adult'],
    'fruiting plants': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/adult'],
    'without sporangia': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/juvenile'],
    'with sporangia': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/adult'],
    'teleomorphs': ['dwciri:lifeStage', 'http://rs.gbif.org/vocabulary/gbif/life_stage/adult'],

    // sex
    'females': ['dwciri:sex', 'http://rs.gbif.org/vocabulary/gbif/sex/female'],
    'males': ['dwciri:sex', 'http://rs.gbif.org/vocabulary/gbif/sex/male'],

    // caste
    'queens': ['dwc:caste', 'queen'],
    'workers': ['dwc:caste', 'worker'],
    'soldiers': ['dwc:caste', 'soldier'],
    'alatae': ['dwc:caste', 'alate'],
    'apterae': ['dwc:caste', 'aptera'],
    'viviparae': ['dwc:caste', 'vivipara'],

    // evidence
    'nests': ['ac:subjectPartLiteral', 'nest'],
    'galls': ['ac:subjectPartLiteral', 'gall'],
    'puparia': ['ac:subjectPartLiteral', 'puparium'],
    'eggcases': ['ac:subjectPart', 'http://rs.tdwg.org/acpart/values/p0031'],
    'bones': ['ac:subjectPartLiteral', 'skeleton'],
    'bones (skulls)': ['ac:subjectPart', 'http://rs.tdwg.org/acpart/values/p0027'],
    'bones (upper jaws)': ['ac:subjectPart', 'http://rs.tdwg.org/acpart/values/p0028'],
    'bones (lower jaws)': ['ac:subjectPart', 'http://rs.tdwg.org/acpart/values/p0029'],
}
const PREFIXES = {
    'ac': 'http://rs.tdwg.org/ac/terms/',
    'bibo': 'http://purl.org/ontology/bibo/',
    'dcterms': 'http://purl.org/dc/terms/',
    'dwc': 'http://rs.tdwg.org/dwc/terms/',
    'dwciri': 'http://rs.tdwg.org/dwc/iri/',
    'foaf': 'http://xmlns.com/foaf/0.1/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'schema': 'https://schema.org/',
    'xsd': 'http://www.w3.org/2001/XMLSchema#',
}
const DWC_FIELDS: Record<string, string> = {
    scientificName: 'dwc:scientificName',
    scientificNameAuthorship: 'dwc:scientificNameAuthorship',
    genericName: 'dwc:genericName',
    infragenericEpithet: 'dwc:infragenericEpithet',
    specificEpithet: 'dwc:specificEpithet',
    infraspecificEpithet: 'dwc:infraspecificEpithet',
    taxonRank: 'dwc:taxonRank',
    taxonRemarks: 'dwc:taxonRemarks',
    taxonomicStatus: 'dwc:taxonomicStatus',
    verbatimIdentification: 'dwc:verbatimIdentification',
}
const GBIF_RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'subspecies']
const GBIF_VOCAB_RANKS = ['domain', 'kingdom', 'subkingdom', 'superphylum', 'phylum', 'subphylum', 'superclass', 'class', 'subclass', 'supercohort', 'cohort', 'subcohort', 'superorder', 'order', 'suborder', 'infraorder', 'superfamily', 'family', 'subfamily', 'tribe', 'subtribe', 'genus', 'subgenus', 'section', 'subsection', 'series', 'subseries', 'speciesAggregate', 'species', 'subspecificAggregate', 'subspecies', 'variety', 'subvariety', 'form', 'subform', 'cultivarGroup', 'cultivar', 'strain']
const STATUSES: Record<string, string> = {
    'accepted': 'http://rs.gbif.org/vocabulary/gbif/taxonomicStatus/accepted',
    'heterotypic synonym': 'http://rs.gbif.org/vocabulary/gbif/taxonomicStatus/heterotypicSynonym',
    'synonym': 'http://rs.gbif.org/vocabulary/gbif/taxonomicStatus/synonym',
}

function getCoveringTaxon (taxa: catalog.Entity[]): string|null {
    if (taxa.length === 1 && !taxa[0].has('gbif')) {
        return `${PREFIX}taxon/${taxa[0].get('id')}`
    }

    function getAncestors (taxon: catalog.Entity): string[] {
        const [...parents] = (taxon.get('parent_taxa') ?? []) as string[]
        if (taxon.has('gbif')) {
            parents.push(taxon.get('gbif') as string)
        }
        return parents
    }

    const ancestors = getAncestors(taxa[0])
    for (const taxon of taxa.slice(1)) {
        const otherAncestors = getAncestors(taxon)

        for (let i = 0; i < ancestors.length; i++) {
            if (ancestors[i] !== otherAncestors[i]) {
                ancestors.splice(i)
            }
        }
    }

    return ancestors.length ? makeGbifUri(ancestors[ancestors.length - 1])['@id'] as string : null
}

function mapEntities (names: string[], entities: catalog.Entity[]): catalog.Entity[] {
    const result = []

    for (const name of names) {
        const entity = entities.find(entity => {
            const values = entity.get('name')
            return Array.isArray(values) ? values.includes(name) : values === name
        })

        if (!entity) {
            console.error('Unmapped entity:', name)
            continue
        }

        result.push(entity as catalog.Entity)
    }

    return result
}

function makeWikidataUri (qid: string): NodeObject {
    return { '@id': `http://www.wikidata.org/entity/${qid}` }
}

function makeGbifUri (id: string): NodeObject {
    return { '@id': `https://gbif.org/species/${id}` }
}

function makeWorkUri (id: string): NodeObject {
    return { '@id': `${PREFIX}catalog/${id}` }
}

function makeScientificNameUri (id: string): NodeObject {
    const resource = id.split(':').slice(0, -1).join(':')
    return { '@id': `${PREFIX}resource/${resource}#${id}` }
}

function makeTaxonRankUri (rank: string): NodeObject|string {
    if (GBIF_VOCAB_RANKS.includes(rank)) {
        return { '@id': `http://rs.gbif.org/vocabulary/gbif/rank/${rank}` }
    } else {
        return rank
    }
}

function makeTaxonomicStatusUri (status: string): NodeObject {
    return { '@id': STATUSES[status] as string }
}

function makeLinkedDataForAuthor (author: catalog.Entity): NodeObject {
    const node: NodeObject = {
        '@id': `${PREFIX}author/${author.get('id')}`,
        '@type': 'foaf:Person',
        'foaf:name': author.get('display_name')
    }

    if (author.has('qid')) {
        node['owl:sameAs'] = makeWikidataUri(author.get('qid') as string)
    }

    return node
}

function makeLinkedDataForPlace (place: catalog.Entity): NodeObject {
    const node: NodeObject = {
        '@id': `${PREFIX}place/${place.get('id')}`,
        '@type': 'dcterms:Location',
        'dcterms:title': place.get('display_name'),
    }

    if (place.has('qid')) {
        node['owl:sameAs'] = makeWikidataUri(place.get('qid') as string)
    }

    return node
}

function makeLinkedDataForPublisher (publisher: catalog.Entity): NodeObject {
    const node: NodeObject = {
        '@id': `${PREFIX}publisher/${publisher.get('id')}`,
        '@type': 'foaf:Organization',
        'foaf:name': publisher.get('display_name')
    }

    if (publisher.has('qid')) {
        node['owl:sameAs'] = makeWikidataUri(publisher.get('qid') as string)
    }

    return node
}

function makeLinkedDataForTaxon (taxon: catalog.Entity): NodeObject {
    const node: NodeObject = {
        '@id': `${PREFIX}taxon/${taxon.get('id')}`,
        '@type': 'dwc:Taxon',
        'dwc:scientificName': taxon.get('display_name'),
    }

    if (taxon.has('rank')) {
        node['dwc:taxonRank'] = makeTaxonRankUri(taxon.get('rank') as string)
    }

    const ids = []
    if (taxon.has('qid')) {
        ids.push(makeWikidataUri(taxon.get('qid') as string))
    }
    if (taxon.has('gbif')) {
        ids.push(makeGbifUri(taxon.get('gbif') as string))
    }
    if (ids.length) {
        node['owl:sameAs'] = ids
    }

    return node
}

function makeLinkedDataForTaxa (files: Catalog): NodeObject[] {
    const nodes = []
    const gbifTaxa: Record<string, NodeObject> = {}

    for (const taxon of files.taxa.entities) {
        const node = makeLinkedDataForTaxon(taxon)

        const ancestors = taxon.get('ancestors_gbif') ?? []
        if (ancestors.length) {
            node['dwc:parentNameUsageID'] = makeGbifUri(ancestors[ancestors.length - 1])
        } else if (taxon.get('id') !== 'T141') {
            node['dwc:parentNameUsageID'] = { '@id': `${PREFIX}taxon/T141` }
        }

        for (let i = 0; i < ancestors.length; i++) {
            gbifTaxa[ancestors[i]] = {
                ...makeGbifUri(ancestors[i]),
                'dwc:taxonRank': makeTaxonRankUri(GBIF_RANKS[i]),
                'dwc:parentNameUsageID': i ? makeGbifUri(ancestors[i - 1]) : { '@id': `${PREFIX}taxon/T141` }
            }
        }

        if (taxon.has('children_gbif')) {
            const children = taxon.get('children_gbif') as string[]
            node['@reverse'] = { 'dwc:parentNameUsageID': children.map(makeGbifUri) as unknown as string }

            const childRank = GBIF_RANKS[ancestors.length]
            for (const child of children) {
                gbifTaxa[child] = {
                    ...makeGbifUri(child),
                    'dwc:taxonRank': makeTaxonRankUri(childRank),
                }
            }
        }

        nodes.push(node)
    }

    nodes.push(...Object.values(gbifTaxa))

    return nodes
}

function makeLinkedDataForScientificName (name: AmendedTaxon): NodeObject {
    const node: NodeObject = {
        ...makeScientificNameUri(name.scientificNameID),
        '@type': 'dwc:Taxon',
    }

    for (const field in DWC_FIELDS) {
        const value = name[field as keyof AmendedTaxon]
        if (value) {
            node[DWC_FIELDS[field]] = value as string
        }
    }

    if (GBIF_VOCAB_RANKS.includes(name.taxonRank)) {
        node[DWC_FIELDS.taxonRank] = makeTaxonRankUri(name.taxonRank)
    }

    if (name.taxonomicStatus) {
        node[DWC_FIELDS.taxonomicStatus] = makeTaxonomicStatusUri(name.taxonomicStatus)
    }

    if (name.acceptedNameUsageID) {
        node['dwc:acceptedNameUsageID'] = makeScientificNameUri(name.acceptedNameUsageID)
    }

    if (name.parentNameUsageID) {
        node['dwc:parentNameUsageID'] = makeScientificNameUri(name.parentNameUsageID)
    }

    const identifiers = []
    if (name.gbifTaxonID) {
        identifiers.push(makeGbifUri(name.gbifTaxonID))
    }
    if (name.colTaxonID) {
        identifiers.push({ '@id': `https://www.checklistbank.org/dataset/309120/taxon/${name.colTaxonID}` })
    }

    if (identifiers.length) {
        node['dwc:taxonID'] = identifiers
    }

    return node
}

function makeLinkedDataForResource (work: catalog.Entity, files: Catalog, resourceId?: ResourceId): NodeObject {
    const resource = new WorkResource({})

    if (!resourceId) {
        resourceId = `${work.get('id')}:0`
    }

    if (files.resources[resourceId] && files.resources[resourceId].metadata.catalog) {
        resource.fields = files.resources[resourceId].metadata.catalog as Record<string, Value>
    }

    if (!resource.has('language')) {
        resource.fields.language = work.get('language') as Value
    }

    const node: NodeObject = {
        ...makeLinkedDataForWork(resource, files),
        '@id': `${PREFIX}resource/${resourceId}`,
        '@type': 'bibo:DocumentPart',
    }

    const types = resource.get('key_type') ?? work.get('key_type') ?? []

    if (types.includes('matrix')) {
        node['dcterms:type'] = { '@id': 'http://purl.org/dc/dcmitype/Software' }
    } else if (types.includes('key') || types.includes('reference') || types.includes('supplement')) {
        node['dcterms:type'] = { '@id': 'http://purl.org/dc/dcmitype/Text' }
    } else if (types.includes('gallery') || types.includes('collection')) {
        node['dcterms:type'] = { '@id': 'http://purl.org/dc/dcmitype/Collection' }
    }

    if (types.includes('key') || types.includes('matrix')) {
        node['ac:subtype'] = { '@id': 'http://rs.tdwg.org/acsubtype/values/IdentificationKey' }
    }

    const taxonNames = resource.get('taxon') ?? work.get('taxon')
    if (taxonNames) {
        const taxa = mapEntities(taxonNames as string[], files.taxa.entities)
        const coveringTaxon = taxa.length ? getCoveringTaxon(taxa) : null
        if (coveringTaxon !== null) {
            node['ac:taxonCoverage'] = { '@id': coveringTaxon }
        }

        node['dwc:taxonID'] = taxa.map(taxon => ({ '@id': `${PREFIX}taxon/${taxon.get('id')}` }))
    }

    const scopes = resource.get('scope') ?? work.get('scope')
    if (scopes) {
        for (const scope of scopes as string[]) {
            if (!SCOPES[scope]) {
                console.error('Unmapped scope:', scope)
                continue
            }

            const [property, ...values] = SCOPES[scope]

            if (!Array.isArray(node[property])) {
                node[property] = []
            }

            for (const value of values) {
                if (value.startsWith('http')) {
                    (node[property] as unknown[]).push({ '@id': value })
                } else {
                    (node[property] as unknown[]).push(value)
                }
            }
        }
    }

    const region = resource.get('region') ?? work.get('region')
    if (region) {
        const places = mapEntities(region as string[], files.places.entities).map(place => ({ '@id': `${PREFIX}place/${place.get('id')}` }))
        node['dcterms:spatial'] = places
    }

    const tags: string[] = []

    const taxonScopes = resource.get('taxon_scope') ?? work.get('taxon_scope')
    if (taxonScopes) {
        tags.push(...taxonScopes as string[])
    } else if ((resource.get('complete') ?? work.get('complete')) === 'FALSE') {
        tags.push('not intended to be complete')
    }

    const targetTaxa = resource.get('target_taxa') ?? work.get('target_taxa')
    if (targetTaxa) {
        const first = (targetTaxa as string[]).slice(0, -1).map(rank => rank + ',')
        const last = targetTaxa[targetTaxa.length - 1]
        const list = first.length ? first.join('') + ' or ' + last : last
        tags.push(`for identification to ${list}`)
    }

    if (tags.length) {
        node['ac:tag'] = tags
    }

    if (files.resources[resourceId].taxa) {
        const leafs = new Set(files.resources[resourceId].taxa.map(taxon => taxon.scientificNameID))
        const taxa = []
        for (const taxon of files.resources[resourceId].taxa) {
            taxa.push(makeLinkedDataForScientificName(taxon))

            if (taxon.parentNameUsageID) {
                leafs.delete(taxon.parentNameUsageID)
            }
        }

        node['dcterms:subject'] = taxa
        node['ac:taxonCount'] = leafs.size
    }

    return node
}

function makeLinkedDataForWork (work: catalog.Entity, files: Catalog): NodeObject {
    const id = work.get('id') as string
    const node: NodeObject = makeWorkUri(id)

    const languages = work.get('language') as string[]
    node['dcterms:language'] = languages.map(language => ({ '@id': `http://id.loc.gov/vocabulary/iso639-1/${language}` }))

    if (work.has('title')) {
        const title = work.get('title') as string[]
        if (title.length > languages.length) {
            title.splice(0, title.length, title.join('; '))
        }
        node['dcterms:title'] = title.map((value, i) => ({ '@value': value, '@language': languages[i] }))
    }

    if (work.has('pages') && (work.get('pages') as string).includes('-')) {
        const containers = work.has('part_of') ? (work.get('part_of') as string[]).map(id => files.catalog.get(id)) : []
        if (containers.find(container => container.get('entry_type') === 'online')) {
            node['@type'] = 'bibo:BookSection'
        } else {
            node['@type'] = 'bibo:AcademicArticle'
        }
    } else if (work.get('entry_type') === 'online') {
        node['@type'] = 'bibo:Website'
    } else {
        node['@type'] = 'bibo:Book'
    }

    if (work.has('author')) {
        const authors = mapEntities(work.get('author') as string[], files.authors.entities).map(author => ({ '@id': `${PREFIX}author/${author.get('id')}` }))
        node['bibo:authorList'] = { '@list': authors }
        node['dcterms:creator'] = authors
    }

    if (work.has('url')) {
        const urls = work.get('url') as string[]

        const handle = urls.find(url => url.startsWith(HANDLE_PREFIX))
        if (handle) {
            node['bibo:handle'] = { '@id': handle.slice(HANDLE_PREFIX.length) }
        }

        node['schema:url'] = urls.map(url => ({ '@id': url }))
    }

    if (work.has('fulltext_url')) {
        const urls = work.get('fulltext_url') as string[]

        node['schema:encoding'] = urls.map(url => ({ '@type': 'schema:MediaObject', 'schema:contentUrl': { '@id': url } }))
    }

    if (work.has('archive_url')) {
        node['schema:archivedAt'] = (work.get('archive_url') as string[]).map(url => ({ '@id': url }))
    }

    if (work.has('date')) {
        const date = work.get('date') as string
        let dateType = 'rdfs:Literal'
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateType = 'xsd:date'
        } else if (date.match(/^\d{4}-\d{2}$/)) {
            dateType = 'xsd:gYearMonth'
        } else if (date.match(/^\d{4}$/)) {
            dateType = 'xsd:gYear'
        }

        node['dcterms:issued'] = { '@value': work.get('date'), '@type': dateType }
    }

    if (work.has('publisher')) {
        const publishers = mapEntities(work.get('publisher') as string[], files.publishers.entities).map(publisher => ({ '@id': `${PREFIX}publisher/${publisher.get('id')}` }))
        node['dcterms:publisher'] = publishers
    }

    if (work.has('ISSN')) {
        node['bibo:issn'] = work.get('ISSN')
    }

    if (work.has('ISBN')) {
        const isbns = work.get('ISBN') as string[]

        for (const isbn of isbns) {
            if (isbn.length === 13) {
                node['bibo:isbn13'] = isbn
            } else if (isbn.length === 10) {
                node['bibo:isbn10'] = isbn
            } else {
                node['bibo:isbn'] = isbn
            }
        }
    }

    if (work.has('QID')) {
        node['bibo:uri'] = makeWikidataUri(work.get('QID') as string)
    }

    if (work.has('DOI')) {
        node['bibo:doi'] = work.get('DOI')
    }

    if (work.has('volume')) {
        node['bibo:volume'] = work.get('volume')
    }

    if (work.has('issue')) {
        node['bibo:issue'] = work.get('issue')
    }

    if (work.has('pages')) {
        const pages = work.get('pages') as string
        const range = pages.split('-')

        if (pages.match(/^\d+$/)) {
            node['bibo:numPages'] = parseInt(pages)
        } else if (range.length === 2) {
            node['bibo:pages'] = pages

            const [start, end] = range.map(part => parseInt(part))
            if (!isNaN(start)) {
                node['bibo:pageStart'] = start
            }
            if (!isNaN(end)) {
                node['bibo:pageEnd'] = end
            }
            if (!isNaN(start) && !isNaN(end)) {
                node['bibo:numPages'] = end - start + 1
            }
        } else {
            node['bibo:pages'] = pages
        }
    }

    if (work.has('edition')) {
        node['bibo:edition'] = work.get('edition')
    }

    if (work.has('license')) {
        const licenses = work.get('license') as string[]
        node['dcterms:rights'] = licenses.map(license => {
            if (license === '<public domain>' || license.match(/^<.+\?>$/)) {
                return license.slice(1, -1)
            } else {
                return { '@id': `https://spdx.org/licenses/${license}.html` }
            }
        })
    }

    return node
}

function makeLinkedDataForWorks (files: Catalog): NodeObject[] {
    const nodes: Record<string, NodeObject> = {}
    const works = files.catalog

    for (const work of works.entities) {
        nodes[work.get('id') as string] = makeLinkedDataForWork(work, files)
    }

    for (const work of works.entities) {
        const id = work.get('id') as string
        const node = nodes[id]
        const language = work.get('language') as string[]

        if (work.has('part_of')) {
            const containers = work.get('part_of') as string[]

            if ((work.get('key_type') as string[]).includes('supplement')) {
                node['bibo:annotates'] = containers.map(makeWorkUri)
            } else {
                node['dcterms:isPartOf'] = containers.map(makeWorkUri)

                for (const container of containers) {
                    if (!Array.isArray(nodes[container]['dcterms:hasPart'])) {
                        nodes[container]['dcterms:hasPart'] = []
                    }
                    (nodes[container]['dcterms:hasPart'] as NodeObject[]).push(makeWorkUri(id))
                }
            }
        }

        if (work.has('listed_in')) {
            const referers = work.get('listed_in') as string[]
            node['bibo:citedBy'] = node['dcterms:isReferencedBy'] = referers.map(makeWorkUri)

            for (const referer of referers) {
                nodes[referer]['bibo:cites'] = nodes[referer]['dcterms:references'] = makeWorkUri(id)
            }
        }

        if (work.has('version_of')) {
            const originals = work.get('version_of') as string[]
            const originalLanguages = originals.map(id => ((works.get(id) as catalog.Entity).get('language') as string[]).join())
            node['bibo:translationOf'] = originals.filter((_, i) => originalLanguages[i] !== language.join()).map(makeWorkUri)
            node['dcterms:isVersionOf'] = originals.filter(id => work.get('id') !== id).map(makeWorkUri)
        }

        let resourceIndex = 1
        let resourceId
        while ((resourceId = `${id}:${resourceIndex++}`) in files.resources) {
            const resource = makeLinkedDataForResource(work, files, resourceId)

            if (!Array.isArray(node['dcterms:hasPart'])) {
                node['dcterms:hasPart'] = []
            }
            (node['dcterms:hasPart'] as NodeObject[]).push(resource)

            if (!Array.isArray(resource['dcterms:isPartof'])) {
                resource['dcterms:isPartof'] = []
            }
            (resource['dcterms:isPartof'] as NodeObject[]).push({ '@id': node['@id'] })
        }
    }

    return Object.values(nodes)
}

async function writeOutput (document: JsonLdDocument, format = 'jsonld'): Promise<void> {
    if (format === 'jsonld') {
        process.stdout.write(JSON.stringify(document, null, 2))
        return
    }

    const nquads = await jsonld.toRDF(document, { format: 'application/n-quads' }) as string
    if (format === 'nquads') {
        process.stdout.write(nquads)
        return
    }

    const parser = new N3.StreamParser()
    const writer = new N3.StreamWriter({ prefixes: PREFIXES })
    parser.write(nquads)
    parser.pipe(writer)
    writer.pipe(process.stdout)
}

async function main (): Promise<void> {
    const args = util.parseArgs({
        allowPositionals: true,
        options: {
            format: {
                type: 'string',
                short: 'f',
                default: 'jsonld',
            }
        },
    })
    const directory = path.resolve(args.positionals[0])

    const files = {} as Catalog
    for (const sheet of SHEETS) {
        const filePath = path.join(directory, `${sheet}.csv`)
        if (!doesFileExist(filePath)) {
            throw new Error(`File "${sheet}.csv" must be provided`)
        }

        const file = await fs.readFile(filePath, 'utf8')
        files[sheet] = catalog.loadData(file, sheet)
    }

    files.resources = {}
    const resources = JSON.parse(await fs.readFile(path.join(directory, 'resources', 'index.json'), 'utf8'))
    for (const id in resources) {
        const filePath = path.join(directory, 'resources', 'dwc', id.split(':').join('-') + '.csv')
        const file = await fs.readFile(filePath, 'utf8')
        const [header, ...rows] = parseCsv(file)
        const taxa = rows.map(row => row.reduce((object, value, index) => {
            object[header[index]] = value
            return object
        }, {} as Record<string, string>) as unknown as AmendedTaxon)

        files.resources[id] = { metadata: resources[id], taxa }
    }

    const graph: NodeObject[] = [
        ...makeLinkedDataForWorks(files),
        ...makeLinkedDataForTaxa(files),
    ]

    for (const entity of files.authors.entities) {
        graph.push(makeLinkedDataForAuthor(entity))
    }
    for (const entity of files.places.entities) {
        graph.push(makeLinkedDataForPlace(entity))
    }
    for (const entity of files.publishers.entities) {
        graph.push(makeLinkedDataForPublisher(entity))
    }

    const document: JsonLdDocument = {
        '@context': PREFIXES,
        '@graph': graph
    }

    writeOutput(document, args.values.format)
}

main().catch((error: Error) => {
    console.error(error)
    process.exit(1)
})
