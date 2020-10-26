# @rvagg/car-to-schema

Read a CAR file and describe its blocks using [IPLD Schemas](https://specs.ipld.io/schemas/).

## Usage

### Install

```sh
$ npm install @rvagg/car-to-schema -g
```

### Run

```sh
$ car-to-schema <path-to-CAR-file> --output=<output/dir> [--library=<schema/library/dir>]
```

Unqiue found schemas will be printed to stdout as well as written to files in the current working directory named `schema_X.ipldsch` (the human-readable text form) and `schema_X.json` (the JSON object descriptor form), where `X` is the unique schema number. A `schema_summary.csv` will also be written with a mapping of the schema to the number of blocks found matching that schema.

### Library

If you have existing Schemas to match against, supply a directory path with `--library` and the Schemas found in that directory will be included in the matching process. Schema files should end with `.ipldsch` (or the object form can be `.json`).

The name of each Schema file in the library directory should be the name of the root type in the Schema. e.g. A Schema Schema describing the DAG-PB structure might be named `PBNode.ipldsch` and include a `type PBNode`. This type will be matched against the root found in the block.

## Limitations

Currently only supports the following codecs for blocks:

* DAG-CBOR
* DAG-JSON
* DAG-PB
* raw
* json

See also the [Limitations section of **ipld-schema-describer**](https://github.com/rvagg/js-ipld-schema-describer#limitations) for the limitations of Schema inference on objects.

## License & Copyright

Copyright 2020 Rod Vagg

Licensed under Apache 2.0 ([LICENSE-APACHE](LICENSE-APACHE) / http://www.apache.org/licenses/LICENSE-2.0)
