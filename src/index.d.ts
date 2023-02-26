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
