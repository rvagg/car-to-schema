#!/usr/bin/env node

import { Readable } from 'stream'
import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import { CarIterator, CarWriter } from '@ipld/car'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagPb from '@ipld/dag-pb'
import * as dagJson from '@ipld/dag-json'
import * as raw from 'multiformats/codecs/raw'
import * as json from 'multiformats/codecs/json'
import SchemaDescriber from 'ipld-schema-describer'
import SchemaValidator from 'ipld-schema-validator'
import Schema from 'ipld-schema'
import schemaPrint from 'ipld-schema/print.js'
import chalk from 'chalk'
import { sha256 } from 'multiformats/hashes/sha2'
import { bytes } from 'multiformats'

const { toHex } = bytes
const textEncoder = new TextEncoder()

const args = minimist(process.argv.slice(2))
const outputDir = args.output
const libraryDir = args.library

if (!args._[0] || args._.length !== 1 || !outputDir) {
  console.log('Usage: car-to-schema <path-to-CAR-file> --output=<output/dir> [--library=<schema/library/dir>]')
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

async function loadLibrary () {
  const library = []
  if (!libraryDir) {
    return library
  }

  const schemaFiles = await fs.promises.readdir(libraryDir)
  for (const schemaFile of schemaFiles) {
    const schemaName = schemaFile.replace(/\.(json|ipldsch)$/, '')
    const type = schemaFile.replace(/^.+\.(json|ipldsch)$/, '$1')
    let schema
    if (type === 'json') {
      const schemaJson = await fs.promises.readFile(path.join(libraryDir, schemaFile), 'utf8')
      schema = JSON.parse(schemaJson)
    } else if (type === 'ipldsch') {
      const schemaDefn = await fs.promises.readFile(path.join(libraryDir, schemaFile), 'utf8')
      schema = Schema.parse(schemaDefn)
    } else { // ignore, that's ok
      continue
    }
    const validator = SchemaValidator.create(schema, schemaName)
    library[schemaName] = validator
  }

  return library
}

async function run () {
  const describedSchemas = {}
  const librarySchemas = {}
  let schemaCount = 0

  const checkLibrarySchema = (obj, byteLength, cid) => {
    for (const [name, validator] of library) {
      if (validator(obj)) {
        if (!librarySchemas[name]) {
          librarySchemas[name] = { id: name, count: 1, sizes: [byteLength] }
        } else {
          librarySchemas[name].count++
          librarySchemas[name].sizes.push(byteLength)
        }
        return true
      }
    }
    return false
  }

  const describeSchema = async (obj, byteLength) => {
    const description = SchemaDescriber.describe(obj)
    const schemaDigest = toHex((await sha256.digest(textEncoder.encode(JSON.stringify(description)))).bytes)
    if (!describedSchemas[schemaDigest]) {
      describedSchemas[schemaDigest] = { id: ++schemaCount, count: 1, description, sizes: [byteLength] }
      const ipldschFile = path.join(outputDir, `schema_${schemaCount}.ipldsch`)
      console.log(`\n${chalk.bold(`Schema #${schemaCount}`)} (${ipldschFile}):`)
      console.log(schemaPrint(description.schema, '  ', highlighter))
      console.log(`\n${chalk.bold('Root: ' + description.root)}`)
      await fs.promises.writeFile(ipldschFile, schemaPrint(description.schema) + '\n', 'utf8')
      return true
    } else {
      describedSchemas[schemaDigest].count++
      describedSchemas[schemaDigest].sizes.push(byteLength)
      return false
    }
  }

  const library = Object.entries(await loadLibrary())
  library.sort((a, b) => a[0] < b[0] ? -1 : 1)
  const inStream = fs.createReadStream(args._[0])
  const reader = await CarIterator.fromIterable(inStream)
  let writer = null
  if (args['novel-out']) {
    const outStream = fs.createWriteStream(args['novel-out'])
    writer = await CarWriter.create([])
    Readable.from(writer).pipe(outStream)
  }
  let count = 0
  for await (const { cid, bytes } of reader.blocks()) {
    const obj = decode(cid, bytes)
    if (!checkLibrarySchema(obj, bytes.length, cid)) {
      await describeSchema(obj, bytes.length)
      if (writer) {
        await writer.put({ cid, bytes })
      }
    }

    if (count++ % 100 === 0) {
      process.stdout.write('.')
    }

    /*
    if (count >= 500000) {
      break
    }
    */
  }

  if (writer) {
    await writer.close()
  }

  const librarySchemaList = Object.values(librarySchemas)
  librarySchemaList.sort((a, b) => a.id < b.id ? -1 : 1)
  const describedSchemaList = Object.values(describedSchemas)
  describedSchemaList.sort((a, b) => a.id < b.id ? -1 : 1)
  const summaryFile = path.join(outputDir, 'schema_summary.csv')
  await fs.promises.writeFile(
    summaryFile,
    librarySchemaList.concat(describedSchemaList)
      .map((s) => {
        s.average = s.sizes.reduce((p, c) => p + c, 0) / s.sizes.length
        return s
      })
      .map((s) => `${s.id}, ${s.count}, ${Math.round(s.average)}`).join('\n') + '\n',
    'utf8')

  console.log(`\nProcessed ${count} blocks, found ${describedSchemaList.length} novel schemas.\nWrote summary to '${summaryFile}'`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
