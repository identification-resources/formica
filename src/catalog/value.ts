import spdxLicenseList = require('spdx-license-list')
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import ietfTagListFactory = require('ietf-language-tag-regex')

const ietfTagList = ietfTagListFactory()

export const FORMATS = {
    ENTRY_TYPE: ['print', 'online', 'cd'],
    KEY_TYPE: ['key', 'matrix', 'reference', 'gallery', 'checklist', 'supplement', 'collection'],
    COMPLETE: ['TRUE', 'FALSE'],

    ID: /^B\d+$/,
    EDTF_0: /^(\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[-+]\d{2}(:\d{2})?))?)?)?|\d{4}(-\d{2}(-\d{2})?)?\/(\d{4}(-\d{2}(-\d{2})?)?|\.\.))$/,
    ISSN_L: /^[0-9]{4}-[0-9]{3}[0-9X]$/,
    ISBN: /^(\d{13}|\d{9}[0-9X])$/,
    DOI: /^10\./,
    QID: /^Q[1-9][0-9]*$/,
    URL: /^(ftp|http|https):\/\/((?:[a-z0-9][a-z0-9-_]*?[a-z0-9]?\.)+(?:xn--)?[a-z0-9]+)(:\d*)?((?:\/(?:%\d\d|[!$&'()*+,\-.0-9";=@A-Z_a-z~])*)*)(\?(?:%\d\d|[!$&'()*+,\-./0-9:;=?@A-Z_a-z~])*)?(#(?:%\d\d|[!$&'()*+,\-./0-9:;=?@A-Z_a-z~])*)?/i,

    LICENSE (value: SingleValue) { return /^<(public domain|.+\?)>$/.test(value) || !!spdxLicenseList[value] },
    LANGUAGE (value: SingleValue) { return ietfTagList.test(value) }
}

export const CHECK = {
    MULTILANG (entry: Record<string, Value>) {
        return entry.language.length > 1
    },

    ISBN (entry: Record<string, Value>) {
        if (entry.ISBN.length < 2) { return false }
        const a = entry.ISBN[0].length === 10
        const b = entry.ISBN[0].length === 13
        const c = entry.ISBN[1].length === 10
        const d = entry.ISBN[1].length === 13
        return (a && d) || (b && c)
    }
}

export function parseValue (value: string, multiple: boolean): Value | null {
    if (value === '') {
        return null
    } else if (multiple) {
        return value.split('; ')
    } else {
        return value
    }
}
