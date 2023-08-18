type Schema = Record<string, FieldSpecification>
type FieldSpecification = {
    required: boolean,
    multiple: boolean | FieldSpecificationCallbackMultiple
    format?: string[] | RegExp | FieldSpecificationCallbackFormat
}

type Value = string[] | string
type SingleValue = string
type FieldSpecificationCallbackMultiple = (entry: Record<string, Value>) => boolean;
type FieldSpecificationCallbackFormat = (value: SingleValue) => boolean;

interface FieldError {
    field: string,
    error: string
}

interface WorkError extends FieldError {
    entity: WorkId
}

type Rank = string
type DwcRank = Rank
type TaxonStatus = string

type TaxonId = string
type ResourceId = string
type WorkId = string

interface WorkingTaxon {
    scientificNameID?: TaxonId,
    scientificName?: string,
    scientificNameAuthorship?: string,
    genericName?: string,
    infragenericEpithet?: string,
    specificEpithet?: string,
    intraspecificEpithet?: string,

    taxonRank?: Rank,
    taxonRemarks?: string,
    collectionCode?: ResourceId,

    taxonomicStatus?: TaxonStatus,
    acceptedNameUsageID?: TaxonId,
    acceptedNameUsage?: string,

    parentNameUsageID?: TaxonId,
    parentNameUsage?: string,
    kingdom?: string,
    phylum?: string,
    class?: string,
    order?: string,
    family?: string,
    subfamily?: string,
    genus?: string,
    subgenus?: string,
    higherClassification?: string,

    // Non-standard
    scientificNameOnly?: string,
    incorrect?: WorkingTaxon
}

interface Taxon extends WorkingTaxon {
    scientificNameID: TaxonId,
    scientificName: string,
    taxonRank: Rank,
    collectionCode: ResourceId,
    taxonomicStatus: string
}

interface ResourceMetadata {
    levels: Rank[],
    scope: string[],
    catalog?: object
}

interface Resource {
    id: string,
    file: string,
    workId: string,
    metadata: ResourceMetadata,
    taxa: Record<TaxonId, Taxon>
}

interface ResourceHistory {
    txt: string,
    dwc: Array<string[][]>
}

type ResourceDiff = ResourceDiffPart[]

interface ResourceDiffPart {
    text: string,
    type: ResourceDiffType
}

type ResourceDiffTokenizer = (text: string) => string[]

declare enum ResourceDiffType {
    Added = '+',
    Deleted = '-',
    Modified = '~',
    Unchanged = '='
}

interface AmendedTaxon extends Taxon {
    colTaxonID?: string,
    colAcceptedTaxonID?: string,
    gbifTaxonID?: string,
    gbifAcceptedTaxonID?: string
}

interface AmendedResource extends Resource {
    taxa: Record<TaxonId, AmendedTaxon>
}

interface TaxonMatch {
    source: number,
    id: string,
    currentId?: string,
    classificationPath: string[]
}

type GroupedNameMatches = Record<string, Record<string, Record<TaxonId, TaxonMatch>>>
