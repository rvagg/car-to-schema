# @rvagg/car-to-schema

Read a CAR file and describe its blocks using [IPLD Schemas](https://specs.ipld.io/schemas/).

## Usage

### Install

```sh
$ npm install @rvagg/car-to-schema -g
```

### Run

```sh
$ car-to-schema <path-to-CAR-file>
```

Unqiue found schemas will be printed to stdout as well as written to files in the current working directory named `schema_X.ipldsch` (the human-readable text form) and `schema_X.json` (the JSON object descriptor form), where `X` is the unique schema number. A `schema_summary.csv` will also be written with a mapping of the schema to the number of blocks found matching that schema.

## Limitations

Currently only [DAG-CBOR](https://specs.ipld.io/block-layer/codecs/dag-cbor.html) format blocks inside a CAR are supported. More codecs may be added as needed.

See also the [Limitations section of **ipld-schema-describer**](https://github.com/rvagg/js-ipld-schema-describer#limitations) for the limitations of Schema inference on objects.

## License & Copyright

Copyright 2020 Rod Vagg

Licensed under Apache 2.0 ([LICENSE-APACHE](LICENSE-APACHE) / http://www.apache.org/licenses/LICENSE-2.0)
