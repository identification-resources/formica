# [0.5.0](https://github.com/identification-resources/formica/compare/v0.4.3...v0.5.0) (2023-10-24)


### Bug Fixes

* **catalog:** make validation more robust ([522db8a](https://github.com/identification-resources/formica/commit/522db8ad428c2d4645569a7f541fd203f5d628e8))
* **csv:** fix csv formatting ([064e5e5](https://github.com/identification-resources/formica/commit/064e5e57b2a642d22850501ab2a0b95879779b85))
* **resources:** do not count abbreviations as species ([ac0cc5a](https://github.com/identification-resources/formica/commit/ac0cc5a7cfd1f68df9b8d1d1c543a2f593839daa))
* **resources:** fix typos in output column names ([0d02823](https://github.com/identification-resources/formica/commit/0d0282378b21e92fbe028a53a9d121f42e791cc5))


### Features

* **resources:** encode names with spaces with underscores ([9c7efd4](https://github.com/identification-resources/formica/commit/9c7efd4daf80660be98f2fec8ef9faa5d5b42d67))
* **resources:** include verbatimIdentification column ([4a2e920](https://github.com/identification-resources/formica/commit/4a2e9201467347e900f5690d2301a3b231ded822))
* **resources:** move "scope" metadata to "catalog" ([286c5b2](https://github.com/identification-resources/formica/commit/286c5b223ce41336f3ebd63c1797403aad21aef6))
* **resources:** update processor configuration ([64daa26](https://github.com/identification-resources/formica/commit/64daa26d70c96df24298c7b78f2b93ef0f5b2a48))


### BREAKING CHANGES

* **resources:**
  - "intragenericEpithet" is now "infragenericEpithet"
  - "intraspecificEpithet" is now "infraspecificEpithet"
* **resources:** Adds additional column, between "higherClassification" and "colTaxonID".
* **resources:**
  - Instead of "-u, --update" use "-s modified"
  - Instead of "--update-mapping" use "-s all"
* **resources:** Index will no longer contain "scope" array. "scope" field in YAML header
does no longer pass validation. Use the "taxon_scope" and "scope" fields
in "catalog" instead.



## [0.4.3](https://github.com/identification-resources/formica/compare/v0.4.2...v0.4.3) (2023-09-30)


### Bug Fixes

* **resource:** fix regression in taxon parsing ([098477b](https://github.com/identification-resources/formica/commit/098477b5914324a3c15ec885617d4cf30996f30d))



## [0.4.2](https://github.com/identification-resources/formica/compare/v0.4.1...v0.4.2) (2023-09-30)


### Bug Fixes

* **resources:** allow simpler intraspecific synonyms ([978186c](https://github.com/identification-resources/formica/commit/978186cbaf469f3085c24c2e8bc8ffb1f83f2799)), closes [#9](https://github.com/identification-resources/formica/issues/9)
* **resources:** correct synonym rank determintation ([766ea2a](https://github.com/identification-resources/formica/commit/766ea2af14ff3aa64a7a2e19ed096836d38182cf))
* **resources:** do not parse "indet." lines as taxa ([f4debf6](https://github.com/identification-resources/formica/commit/f4debf695b0cdb375bfb60ab5ce942fa2f7dee85)), closes [#8](https://github.com/identification-resources/formica/issues/8)



## [0.4.1](https://github.com/identification-resources/formica/compare/v0.4.0...v0.4.1) (2023-09-07)


### Bug Fixes

* **catalog:** fix typo in duplicate_of schema ([fbb6333](https://github.com/identification-resources/formica/commit/fbb6333d10dd6f5846856ea8de81d941ce539d21))



# [0.4.0](https://github.com/identification-resources/formica/compare/v0.3.1...v0.4.0) (2023-09-07)


### Bug Fixes

* **catalog:** validation checks for unknown fields ([5fe5cf0](https://github.com/identification-resources/formica/commit/5fe5cf0b8cf4db7c4af50a897821077e410a1e09))
* **catalog:** verify if required fields are missing ([c327ae4](https://github.com/identification-resources/formica/commit/c327ae458a80567aac34dd03f3970dcf9d575479))


### Features

* **catalog:** add duplicate_of field ([e4a8bbe](https://github.com/identification-resources/formica/commit/e4a8bbecef9c6a40d0f2cc5d4e8bb67685a453ff))



## [0.3.1](https://github.com/identification-resources/formica/compare/v0.3.0...v0.3.1) (2023-09-04)


### Bug Fixes

* **resources:** allow correction of synonyms of lowest taxa ([c737d5b](https://github.com/identification-resources/formica/commit/c737d5b09d5e5b24f4cc2c8cff88c9ada8d0ab7b))
* **resources:** fix regression in c737d5b ([d4e52e9](https://github.com/identification-resources/formica/commit/d4e52e95ed1a35dabbd80b9f9aace1a824fdae98))
* **resources:** handle corrections to synonyms ([21ed9b7](https://github.com/identification-resources/formica/commit/21ed9b79f77e1e6d0639d96ed9822d5212a85a2e)), closes [#4](https://github.com/identification-resources/formica/issues/4)



# [0.3.0](https://github.com/identification-resources/formica/compare/v0.2.1...v0.3.0) (2023-08-20)


### Features

* **resources:** add accepted ids to dwc and index ([1b5aba8](https://github.com/identification-resources/formica/commit/1b5aba8ff07bba32fc1bbf49927fef7a880eb35e))
* **resources:** allow updates of just mappings ([0ea62c1](https://github.com/identification-resources/formica/commit/0ea62c143a49129709960de123c0037973356487))
* **resources:** improve prefix selection heuristics ([7c2e0c9](https://github.com/identification-resources/formica/commit/7c2e0c99d9de7490314f971e8b4e9e5e190a81c2))
* **resources:** improve taxon name matching ([78ff480](https://github.com/identification-resources/formica/commit/78ff480485ca42bd1d1f2893f230e61db6cb6be8)), closes [#2](https://github.com/identification-resources/formica/issues/2)
* **resources:** test for rank mismatch ([0e69b7f](https://github.com/identification-resources/formica/commit/0e69b7f0a6654fa5255e797be7516cd06edb4df3)), closes [#2](https://github.com/identification-resources/formica/issues/2)



## [0.2.1](https://github.com/identification-resources/formica/compare/v0.2.0...v0.2.1) (2023-08-10)


### Bug Fixes

* **resources:** do not validate old versions ([1a8dd2e](https://github.com/identification-resources/formica/commit/1a8dd2e0e373489e287d1fd89dbb7443245c5214))
* **resources:** fix check for missing leaf taxa ([035f1ad](https://github.com/identification-resources/formica/commit/035f1ad20efa80b388ec3828d4ace4518c7b344e))



# [0.2.0](https://github.com/identification-resources/formica/compare/v0.1.1...v0.2.0) (2023-08-09)


### Features

* **catalog:** add taxon_scope column ([6a06c37](https://github.com/identification-resources/formica/commit/6a06c37ec0640a8ffbc258ad6a4d81d84d35fee9))
* **resources:** check for missing leaf taxa ([387c47d](https://github.com/identification-resources/formica/commit/387c47d10bb7f1fb09a68c10dfa869bb924b7633))



## [0.1.1](https://github.com/identification-resources/formica/compare/v0.1.0...v0.1.1) (2023-05-10)


### Bug Fixes

* **processor:** add Node hashbang ([51dee57](https://github.com/identification-resources/formica/commit/51dee57b8547afba449b2b846bd7d65e7927368f))



# [0.1.0](https://github.com/identification-resources/formica/compare/fed91fd6f350c47bd067d221a4d0e2278a199dae...v0.1.0) (2023-03-01)


### Bug Fixes

* **resources:** fix typo in taxon name pattern ([8f1b6cf](https://github.com/identification-resources/formica/commit/8f1b6cfa3858edb83c0aee589b84ad760ab815af))
* **resources:** improve name parsing heuristics ([a40642e](https://github.com/identification-resources/formica/commit/a40642e9bdaeaae363584712e45f218809a5754b))


### Features

* **catalog:** add SDK for catalog data ([fed91fd](https://github.com/identification-resources/formica/commit/fed91fd6f350c47bd067d221a4d0e2278a199dae))
* **csv:** allow custom delims in output ([b523614](https://github.com/identification-resources/formica/commit/b523614171b0ff96347cb876a08106df413c4032))
* **processor:** processor for DwC creation ([0e6f21d](https://github.com/identification-resources/formica/commit/0e6f21dfe00a2892348a4ab04fcaf3d6c8324a91))
* **processor:** processor for DwC indexing ([279773b](https://github.com/identification-resources/formica/commit/279773b085676cf7cb3eb4d81496ad219ac85bce))
* **resources:** add SDK for resource text files ([0acd36d](https://github.com/identification-resources/formica/commit/0acd36dde04cc1240cb8be97d48812b201b2685a))
* **resources:** add support for cluster markings ([112315c](https://github.com/identification-resources/formica/commit/112315c7ebd7151c4e2cc77ab20e0cec3f579db6))
* **resources:** add support for diffs as input ([9751627](https://github.com/identification-resources/formica/commit/9751627a916f47552661596048f1f0d44d89b102))
* **resources:** add support for hybrids ([e49e96a](https://github.com/identification-resources/formica/commit/e49e96af9c3958bab2a3b0508b1fc8a018b80716))
* **validate:** add catalog validation script ([4cdf785](https://github.com/identification-resources/formica/commit/4cdf785afb2c77320cd9b5b76483e3464c0f1cff))
* **validate:** add script to validate resources ([246fb5d](https://github.com/identification-resources/formica/commit/246fb5dd8da03e736884850874cc51a11be9985c))



