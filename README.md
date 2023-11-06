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
    and link the taxa to GBIF and Catalogue of Life identifiers. Use the `-u` or
    `--update` flag in a Git repo to update existing Darwin Core files while keeping
    the identifiers stable (in most cases).
  - `loir-resources-index [./resources]`: Create indices of the Darwin Core archives.

## API

```js
const Formica = require('@larsgw/formica')

// Load catalog data
const catalog = Formica.catalog.loadData(`...`, 'catalog')
```
