#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import { CarIterator } from '@ipld/car'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagPb from '@ipld/dag-json'
import * as dagJson from '@ipld/dag-pb'
import * as raw from 'multiformats/codecs/raw'
import * as json from 'multiformats/codecs/json'
import SchemaDescriber from 'ipld-schema-describer'
import schemaPrint from 'ipld-schema/print.js'
import chalk from 'chalk'
import { sha256 } from 'multiformats/hashes/sha2'
import { bytes } from 'multiformats'

const { toHex } = bytes
const textEncoder = new TextEncoder()

const args = minimist(process.argv.slice(2))
const outputDir = args.output

if (!args._[0] || args._.length !== 1 || !outputDir) {
  console.log('Usage: car-to-schema.js <path/to/car> --output <dir>')
  process.exit(1)
}

const highlighter = {
  keyword: (s) => chalk.magenta(s),
  builtin: (s) => chalk.magenta(s),
  operator: (s) => chalk.gray(s),
  string: (s) => chalk.green(s),
  className: (s) => chalk.yellow(s),
  punctuation: (s) => chalk.blackBright(s)
}

const decoders = {
  [dagCbor.code]: dagCbor.decode,
  [dagPb.code]: dagPb.decode,
  [dagJson.code]: dagJson.decode,
  [raw.code]: raw.decode,
  [json.code]: json.decode
}

function decode (cid, bytes) {
  if (typeof decoders[cid.code] !== 'function') {
    throw new Error(`Unknown codec code: 0x${cid.code.toString(16)}`)
  }
  return decoders[cid.code](bytes)
}

async function run () {
  const schemas = {}
  let schemaCount = 0

  const inStream = fs.createReadStream(args._[0])
  const reader = await CarIterator.fromIterable(inStream)
  let count = 0
  for await (const { cid, bytes } of reader.blocks()) {
    const obj = decode(cid, bytes)
    // console.log(obj) //, { depth: Infinity })
    const description = SchemaDescriber.describe(obj)
    // console.dir({ schema, root }, { depth: Infinity })
    const schemaDigest = toHex((await sha256.digest(textEncoder.encode(JSON.stringify(description)))).bytes)
    if (!schemas[schemaDigest]) {
      schemas[schemaDigest] = { id: ++schemaCount, count: 1, description }
      const jsonFile = path.join(outputDir, `schema_${schemaCount}.json`)
      const ipldschFile = path.join(outputDir, `schema_${schemaCount}.ipldsch`)
      console.log(`\n${chalk.bold(`Schema #${schemaCount}`)} (${jsonFile}, ${ipldschFile}):`)
      console.log(schemaPrint(description.schema, '  ', highlighter))
      console.log(`\n${chalk.bold('Root: ' + description.root)}`)
      await Promise.all([
        fs.promises.writeFile(jsonFile, JSON.stringify(description.schema, null, 2) + '\n', 'utf8'),
        fs.promises.writeFile(ipldschFile, schemaPrint(description.schema) + '\n', 'utf8')
      ])
    } else {
      schemas[schemaDigest].count++
    }

    if (count++ % 100 === 0) {
      process.stdout.write('.')
    }

    /*
    if (count >= 30000) {
      break
    }
    */
  }

  const schemaList = Object.values(schemas)
  schemaList.sort((a, b) => a.id < b.id ? -1 : 1)
  await fs.promises.writeFile(
    path.join(outputDir, 'schema_summary.csv'),
    schemaList.map((s) => `${s.id}, ${s.count}`).join('\n') + '\n',
  'utf8')

  console.log(`\nProcessed ${count} blocks, found ${schemaList.length} schemas, summary written to 'schema_summary.csv'`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
