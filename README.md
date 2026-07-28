# Formica

**Formica** is an SDK and a collection of tools for the data in the Library of
Identification Resources.

## Install

Install globally:

    npm install --global @larsgw/formica

Run locally:

    npx --package @larsgw/formica -- ...

## CLI

  - `loir-validate-catalog [./catalog.csv ./authors.csv ./places.csv ./publishers.csv]`:
    Validate the CSV files containing metadata ([schema](https://github.com/identification-resources/catalog/blob/main/docs/tools-resources.md)).
  - `loir-validate-resources [./B1234.txt]`:
    Validate the `.txt` files containing information on the taxonomic scope of keys
    ([documentation](https://github.com/identification-resources/catalog/blob/main/docs/resources-txt.md)).
  - `loir-resources-process [./resources]`:
    Interactive tool to convert the aforementioned `.txt` files to Darwin Core archives
    ([documentation](https://github.com/identification-resources/catalog/blob/main/docs/resources-dwc.md)),
    and link the taxa to GBIF and Catalogue of Life identifiers.
      - Use `-s` or `--source` to specify which files should be processed: `unprocessed`
        (default) for `.txt` files without corresponding Darwin Core files; `modified`
        if in a Git repo to update existing Darwin Core files while keeping the identifiers
        stable (in most cases); `all` for all `.txt` files; or `dwc` for only update
        identifier mappings.
      - Use `-u` or `--update-mappings` to specify which mappings to update: `col` or
        `gbif`. This argument can be repeated. By default, both COL and GBIF are updated.
      - Use `-k` or `--keep-mappings` to not update any mappings. Cannot be used in
        conjunction with `-u`.
      - Use `--mapping-api` to use either `gnverifier` (default) or `clb`, the ChecklistBank
        API, to update the mappings.
  - `loir-resources-index [./resources]`: Create indices of the Darwin Core archives.

## API

```js
const Formica = require('@larsgw/formica')

// Load catalog data
const catalog = Formica.catalog.loadData(`...`, 'catalog')
```
