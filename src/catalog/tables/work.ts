import { FORMATS, CHECK } from '../value'
import { Entity } from '../entity'

export class Work extends Entity {
    constructor (values: Record<string, string>) {
        super(values, {
            id: { required: true, multiple: false, format: FORMATS.WORK_ID },
            title: { required: true, multiple: CHECK.MULTILANG },
            author: { required: false, multiple: true },
            url: { required: false, multiple: true, format: FORMATS.URL },
            fulltext_url: { required: false, multiple: true, format: FORMATS.URL },
            archive_url: { required: false, multiple: true, format: FORMATS.URL },
            entry_type: { required: true, multiple: false, format: FORMATS.ENTRY_TYPE },
            date: { required: false, multiple: false, format: FORMATS.EDTF_0 },
            publisher: { required: false, multiple: true },
            series: { required: false, multiple: false },
            ISSN: { required: false, multiple: false, format: FORMATS.ISSN_L },
            ISBN: { required: false, multiple: CHECK.ISBN, format: FORMATS.ISBN },
            DOI: { required: false, multiple: false, format: FORMATS.DOI },
            QID: { required: false, multiple: false, format: FORMATS.QID },
            volume: { required: false, multiple: false },
            issue: { required: false, multiple: false },
            pages: { required: false, multiple: false },
            edition: { required: false, multiple: false },
            language: { required: true, multiple: true, format: FORMATS.LANGUAGE },
            license: { required: false, multiple: true, format: FORMATS.LICENSE },
            key_type: { required: true, multiple: true, format: FORMATS.KEY_TYPE },
            taxon: { required: true, multiple: true },
            taxon_scope: { required: false, multiple: true },
            scope: { required: false, multiple: true },
            region: { required: true, multiple: true },
            complete: { required: false, multiple: false, format: FORMATS.COMPLETE },
            target_taxa: { required: false, multiple: true },
            listed_in: { required: false, multiple: true, format: FORMATS.WORK_ID },
            part_of: { required: false, multiple: true, format: FORMATS.WORK_ID },
            version_of: { required: false, multiple: true, format: FORMATS.WORK_ID },
            duplicate_of: { required: false, multiple: false, format: FORMATS.WORK_ID }
        })
    }

    deriveFields () {
        if (typeof this.fields.date === 'string') {
            const year = parseInt(this.fields.date.split('-')[0])
            this.derivedFields.year = year.toString()
            this.derivedFields.decade = (year - (year % 10)).toString()
        }

        if (typeof this.fields.license === 'string' && !this.fields.license.endsWith('?>')) {
            this.derivedFields.access = 'Open license'
        } else {
            const info = this.fields.url
            const content = this.fields.fulltext_url
            const archive = this.fields.archive_url

            if (typeof content === 'string') {
                this.derivedFields.access = 'Full text available, no license'
            } else if (typeof archive === 'string' && (!(typeof info === 'string') || !archive.endsWith(info))) {
                this.derivedFields.access = 'Archived full text available, no license'
            } else {
                this.derivedFields.access = 'No full text available'
            }
        }
    }
}
