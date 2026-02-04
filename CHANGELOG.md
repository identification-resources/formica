# [0.9.0](https://github.com/identification-resources/formica/compare/v0.8.8...v0.9.0) (2026-02-04)


### Bug Fixes

* **resources:** improve taxonomic status ([0ea8fd2](https://github.com/identification-resources/formica/commit/0ea8fd220571f5f6ff05f517069aba10148c6888))


### Features

* **resources:** include cluster data in DwC files ([60a28ac](https://github.com/identification-resources/formica/commit/60a28ace18b0760696735ca416a2e8d014d1c928))
* **resources:** include uncertainty of synonymy in DwC if specified ([03b6734](https://github.com/identification-resources/formica/commit/03b6734851dc9c331ec88fab21e90ad3f0303c3c))



## [0.8.8](https://github.com/identification-resources/formica/compare/v0.8.7...v0.8.8) (2025-12-25)


### Features

* **resources:** add 'subclass' rank ([4b10405](https://github.com/identification-resources/formica/commit/4b10405b32840c1675caf7ef24bf2bbfd821a236))



## [0.8.7](https://github.com/identification-resources/formica/compare/v0.8.6...v0.8.7) (2025-11-01)


### Bug Fixes

* **resources:** fix handling of corrections ([49c05b4](https://github.com/identification-resources/formica/commit/49c05b499262e64514b832313360d1e6a4cc6378))



## [0.8.6](https://github.com/identification-resources/formica/compare/v0.8.5...v0.8.6) (2025-10-28)


### Bug Fixes

* **resources:** fix diffs if last line changes ([a86c3e9](https://github.com/identification-resources/formica/commit/a86c3e97ae31cf9d509fff4a7525d56c05f79752))
* **resources:** fix recognition of subgenus synonyms ([4c52599](https://github.com/identification-resources/formica/commit/4c525991dafac83176b96b2e04c5c952d777ac08))


### Features

* **resources:** ignore errors in later-corrected names ([4c1f69e](https://github.com/identification-resources/formica/commit/4c1f69e81450664f122cdf00e68cb918248790e6)), closes [#5](https://github.com/identification-resources/formica/issues/5)



## [0.8.5](https://github.com/identification-resources/formica/compare/v0.8.4...v0.8.5) (2025-10-28)


### Bug Fixes

* **catalog:** add mapping for typo 'male' in linked data ([a83d34e](https://github.com/identification-resources/formica/commit/a83d34e7aa57a78e410e2ea55adbf75e522d9028))
* **catalog:** fix dcmitype: for algorithms, checklists ([68e353d](https://github.com/identification-resources/formica/commit/68e353d71d632e092e3e79254e6b4f575c004f1c))
* **catalog:** fix typos in linked data generation ([9ad951f](https://github.com/identification-resources/formica/commit/9ad951f5c19978509c6aba7fd81470270707da99))
* **resources:** add scientific name for complexes, aggregates ([843afc3](https://github.com/identification-resources/formica/commit/843afc39df1952dda4bb6339ee47f2619432bb74))
* **resources:** omit generic error stack trace ([c831bc2](https://github.com/identification-resources/formica/commit/c831bc2a952ef17a9e57b012fe0568e2acc0c6ae))


### Features

* **resources:** handle subgenus synonyms of genera ([4e61336](https://github.com/identification-resources/formica/commit/4e61336e36054ffd6df57ebad5479e7ceebcb235)), closes [#16](https://github.com/identification-resources/formica/issues/16)
* **resources:** rework parsing of resources ([cff7730](https://github.com/identification-resources/formica/commit/cff773000c5b9e3f990c619cdd45a76a18ee39a9)), closes [#15](https://github.com/identification-resources/formica/issues/15) [#7](https://github.com/identification-resources/formica/issues/7)



## [0.8.4](https://github.com/identification-resources/formica/compare/v0.8.3...v0.8.4) (2025-09-19)


### Bug Fixes

* **catalog:** clearer error message when validating ([b1c34f0](https://github.com/identification-resources/formica/commit/b1c34f00ed9a262251d2d24b3e6c46fd17730405))
* **resources:** optimize diffing algorithm ([0c86c49](https://github.com/identification-resources/formica/commit/0c86c49474754dced74c8423f3e6b7ed2fd2a78f)), closes [#6](https://github.com/identification-resources/formica/issues/6)


### Features

* **catalog:** map additional scope value ([80c6d26](https://github.com/identification-resources/formica/commit/80c6d269a7d5b03600991fb353280e81afcefb0e))



## [0.8.3](https://github.com/identification-resources/formica/compare/v0.8.2...v0.8.3) (2025-07-15)


### Features

* **catalog:** add catalog field key_characteristics ([6529cfa](https://github.com/identification-resources/formica/commit/6529cfab81f759f926b81bdd9d5a36e84b526284))



## [0.8.2](https://github.com/identification-resources/formica/compare/v0.8.1...v0.8.2) (2025-06-26)


### Bug Fixes

* **resources:** add support for documented flag ([6cb89e4](https://github.com/identification-resources/formica/commit/6cb89e428bde8665b7e8f03b5c7f47a44e15f58e))
* **resources:** allow hyphens in biname pattern ([6a58a77](https://github.com/identification-resources/formica/commit/6a58a77757b8b6ae8c2d7d01440775776d183d05))



## [0.8.1](https://github.com/identification-resources/formica/compare/v0.8.0...v0.8.1) (2025-05-30)


### Bug Fixes

* **catalog:** fix aspects of linked data ([1b2964f](https://github.com/identification-resources/formica/commit/1b2964f46b8409c6a67f0475faf067a80734288c))
* **catalog:** set display_name to required, as documented ([3f36909](https://github.com/identification-resources/formica/commit/3f36909bbe6261cbee022139050875de37174611))


### Features

* **resources:** add support for "(sub)gen. nov" pattern ([d2598eb](https://github.com/identification-resources/formica/commit/d2598ebfd2f80d9c2bcc00ce145b9fc229316e5b))



# [0.8.0](https://github.com/identification-resources/formica/compare/v0.7.3...v0.8.0) (2025-05-07)


### Bug Fixes

* **catalog:** remove unused obsolete 'clean-links' script ([af1ecc2](https://github.com/identification-resources/formica/commit/af1ecc2fdd0a80bb8fa7108f3d52978239d7ef01))


### Features

* **catalog:** implement generation of linked data ([334616e](https://github.com/identification-resources/formica/commit/334616e2e12c0d91e49f84f06bdd00ab7a238b8e))



## [0.7.3](https://github.com/identification-resources/formica/compare/v0.7.2...v0.7.3) (2025-04-17)


### Features

* **catalog:** update validation for identifiers ([156a703](https://github.com/identification-resources/formica/commit/156a7036ab09c411d091bc9d0f628831a30ba3f5))



## [0.7.2](https://github.com/identification-resources/formica/compare/v0.7.1...v0.7.2) (2025-04-02)


### Features

* **catalog:** add validation for taxa.csv ([59cfcf2](https://github.com/identification-resources/formica/commit/59cfcf28ebbef42e28e648e800c178a7d528f37a))



## [0.7.1](https://github.com/identification-resources/formica/compare/v0.7.0...v0.7.1) (2025-03-25)


### Features

* **resources:** add 'subphylum' rank ([8b5243b](https://github.com/identification-resources/formica/commit/8b5243bfd79b6486c613ca1178f1e1c9ec3f43a4))



# [0.7.0](https://github.com/identification-resources/formica/compare/v0.6.8...v0.7.0) (2025-03-14)


### Bug Fixes

* **resources:** improve diff regarding indet lines ([2615437](https://github.com/identification-resources/formica/commit/26154374f50d680c5f3e187cd6a1a5eadbac6b5d))


### Features

* **resources:** change syntax of "indet" line ([d53363e](https://github.com/identification-resources/formica/commit/d53363e65bfa77a2eb247999316621f9ca0bff59))


### BREAKING CHANGES

* **resources:** "indet" lines now have to be prefixed with "[indet]"



## [0.6.8](https://github.com/identification-resources/formica/compare/v0.6.7...v0.6.8) (2025-03-13)


### Features

* **resources:** add support for intergeneric hybrids without parents ([3cb0c0c](https://github.com/identification-resources/formica/commit/3cb0c0cd60fc5a4ba88add623fbadc3b90d8530c))
* **resources:** create index of CoL identifiers ([3792903](https://github.com/identification-resources/formica/commit/37929035374bc0c67ed2403e775e06a904bdbd4d))
* **resources:** support intergeneric hybrids ([0a6696c](https://github.com/identification-resources/formica/commit/0a6696c5fd0603a0366c80c2298b6544636ed0c6))



## [0.6.7](https://github.com/identification-resources/formica/compare/v0.6.6...v0.6.7) (2025-02-26)


### Bug Fixes

* **resources:** keep uncorrected name in verbatimIdentification ([dc4d5d1](https://github.com/identification-resources/formica/commit/dc4d5d17e7a412a94538f6162dfd839d808cbc30))
* **resources:** update heuristics for recognizing author citations ([bca6a7f](https://github.com/identification-resources/formica/commit/bca6a7f5a6c2dc3dc421d885f6270f5464fc5ea5))
* **resources:** use corrected generic name in output ([b472384](https://github.com/identification-resources/formica/commit/b4723842e87515f076230c603246082bc3bbec9d))


### Features

* **resources:** add support for completeness flags ([55b5427](https://github.com/identification-resources/formica/commit/55b5427125b4f1072191cadbc461ba31d37e6f2e))



## [0.6.6](https://github.com/identification-resources/formica/compare/v0.6.5...v0.6.6) (2025-02-16)


### Features

* **resources:** allow other resources in version_of ([85947b0](https://github.com/identification-resources/formica/commit/85947b0dcfbdb4bfd6537c628b34087a6e6326f7))



## [0.6.5](https://github.com/identification-resources/formica/compare/v0.6.4...v0.6.5) (2024-12-20)


### Bug Fixes

* **resources:** ignore empty lines in diff mode ([3fb027e](https://github.com/identification-resources/formica/commit/3fb027e8968196910fff2e574e700ac0abee996c))
* **resources:** improve (ICBN) author parsing ([d3e3faf](https://github.com/identification-resources/formica/commit/d3e3faf411d1a7dccd528a5ee78bd0823a5883b4)), closes [#13](https://github.com/identification-resources/formica/issues/13) [#14](https://github.com/identification-resources/formica/issues/14)
* **resources:** support "et al." in author name ([82993bf](https://github.com/identification-resources/formica/commit/82993bffac5e7f3ed00d00c28c836f347b264a43))



## [0.6.4](https://github.com/identification-resources/formica/compare/v0.6.3...v0.6.4) (2024-12-16)


### Bug Fixes

* **resources:** fix matching of some ICBN names ([3c18458](https://github.com/identification-resources/formica/commit/3c184586b64e2a31f1eb7298bcd7c80c1d119069))



## [0.6.3](https://github.com/identification-resources/formica/compare/v0.6.2...v0.6.3) (2024-04-12)


### Bug Fixes

* **resources:** allow 'phylum' rank ([ff9be66](https://github.com/identification-resources/formica/commit/ff9be66abab79a86263764b54d6a2709833b14d4))



## [0.6.2](https://github.com/identification-resources/formica/compare/v0.6.1...v0.6.2) (2024-04-08)


### Bug Fixes

* **catalog:** include all fields in tabular export ([c4e47bb](https://github.com/identification-resources/formica/commit/c4e47bbdf31c8f589e35c897c8207eb4dd979461))


### Features

* **catalog:** add script to de-duplicate links ([b719348](https://github.com/identification-resources/formica/commit/b719348635e1b35ee80758c0cdd9938625d79ebf))



## [0.6.1](https://github.com/identification-resources/formica/compare/v0.6.0...v0.6.1) (2024-03-20)


### Bug Fixes

* **resources:** allow two-part hybrid names ([8e3b836](https://github.com/identification-resources/formica/commit/8e3b8368985d1db35b62d306d833121150e91865))



# [0.6.0](https://github.com/identification-resources/formica/compare/v0.5.2...v0.6.0) (2024-01-05)


### Features

* **catalog:** add entry type, key type values ([ed6e4fb](https://github.com/identification-resources/formica/commit/ed6e4fb545e09cddb5d466f602bffb8a8483f043))



## [0.5.2](https://github.com/identification-resources/formica/compare/v0.5.1...v0.5.2) (2023-11-27)


### Bug Fixes

* **resources:** fix GBIF index generation ([c88e2d2](https://github.com/identification-resources/formica/commit/c88e2d2b306b930ca0b00b978e3eb89b8adfb656))



## [0.5.1](https://github.com/identification-resources/formica/compare/v0.5.0...v0.5.1) (2023-11-03)


### Bug Fixes

* **resources:** fix file listing in processor ([009b980](https://github.com/identification-resources/formica/commit/009b98091b0f597e91213ace82252facbe3b5fed))



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

* **resources:** - "intragenericEpithet" is now "infragenericEpithet"
- "intraspecificEpithet" is now "infraspecificEpithet"
* **resources:** Adds additional column, between "higherClassification" and "colTaxonID".
* **resources:** - Instead of "-u, --update" use "-s modified"
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



