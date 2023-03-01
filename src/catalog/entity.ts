import { parseValue } from './value'

export class Entity {
    fields: Record<string, Value>;
    schema: Schema;
    derivedFields: Record<string, Value>;

    constructor (values: Record<string, string>, schema: Schema) {
        this.fields = {}
        for (const key in values) {
            const value = parseValue(values[key], !!schema[key].multiple)
            if (value !== null) {
                this.fields[key] = value
            }
        }

        this.schema = schema
        this.derivedFields = {}
    }

    /* eslint-disable @typescript-eslint/no-empty-function */
    deriveFields () {
    }
    /* eslint-enable @typescript-eslint/no-empty-function */

    get (key: string): Value | undefined {
        if (key in this.fields) {
            return this.fields[key]
        } else if (key in this.derivedFields) {
            return this.derivedFields[key]
        }
    }

    has (key: string): boolean {
        return key in this.fields || key in this.derivedFields
    }

    validate (): FieldError[] {
        const errors = []
        for (const field in this.fields) {
            for (const error of this._validateField(field)) {
                errors.push({ field, error })
            }
        }
        return errors
    }

    _validateField (field: string) {
        const errors = []

        if (!(field in this.fields)) {
            if (this.schema[field].required) {
                errors.push('Value(s) required but missing')
            }
            return errors
        }

        const valueCountError = this._validateValueCount(field, this.fields[field])
        if (valueCountError !== undefined) {
            errors.push(valueCountError)
        }

        let values = this.fields[field]
        if (!Array.isArray(values)) {
            values = [values]
        }

        for (const value of values) {
            const result = this._validateSingleValue(field, value)
            if (result !== undefined) {
                errors.push(result)
            }
        }

        return errors
    }

    _validateValueCount (field: string, value: Value): string | undefined {
        const multipleConfig = this.schema[field].multiple
        const allowMultiple = typeof multipleConfig === 'function'
            ? multipleConfig.call(null, this.fields)
            : multipleConfig

        if (allowMultiple === false) {
            let multiple = false

            if (Array.isArray(value) && value.length > 2) {
                multiple = true
            } else if (typeof value === 'string' && value.includes('; ')) {
                multiple = true
            }

            if (multiple) {
                return 'Multiple values but only one expected'
            }
        }

        return undefined
    }

    _validateSingleValue (field: string, value: SingleValue): string | undefined {
        const config = this.schema[field].format
        if (config === undefined) {
            return undefined
        } else if (Array.isArray(config) && (value === null || !config.includes(value))) {
            return `The value "${value}" is not included: ${config.join(', ')}`
        } else if (config instanceof RegExp && !config.test(value)) {
            return `The value "${value}" does not conform to pattern: ${config.source}`
        } else if (typeof config === 'function' && !config.call(null, value)) {
            return `The value "${value}" does not conform to pattern: ${config.name}`
        }
    }
}
