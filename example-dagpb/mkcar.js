import fs from 'fs'
import * as dagPb from '@ipld/dag-pb'
import CID from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { Readable } from 'stream'
import { CarWriter } from '@ipld/car'

async function block (obj) {
  const bytes = dagPb.encode(obj)
  const hash = await sha256.digest(bytes)
  const cid = CID.create(0, dagPb.code, hash)
  return { cid, bytes }
}

const acid = CID.decode(Uint8Array.from([1, 85, 0, 5, 0, 1, 2, 3, 4]))

const dataForms = [
  undefined,
  new Uint8Array(0),
  Uint8Array.from([0, 1, 2, 3, 4])
]
const linksForms = [
  [],
  [{ Hash: acid }],
  [{ Hash: acid, Name: '' }],
  [{ Hash: acid, Name: 'some name' }],
  [{ Hash: acid, Tsize: 0 }],
  [{ Hash: acid, Tsize: 9007199254740991 }],
  [{ Hash: acid, Name: 'some name', Tsize: 9007199254740991 }]
]

async function run () {
  const writer = CarWriter.create([])
  Readable.from(writer).pipe(fs.createWriteStream('dagpb.car'))
  for (const dataForm of dataForms) {
    for (const linksForm of linksForms) {
      const obj = {}
      if (dataForm) {
        obj.Data = dataForm
      }
      obj.Links = linksForm
      await writer.put(await block(obj))
    }
  }
  await writer.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
