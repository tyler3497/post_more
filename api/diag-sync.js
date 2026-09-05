// TEMPORARY diagnostic endpoint — remove after diagnosing KV sync stall
import fs from 'fs'
import path from 'path'
import { getKV, getPostsTotal, getPostIdsPage, syncUnifiedFromFiles } from './_db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const out = { cwd: process.cwd() }
  for (const [label, rel] of [['satire', ['public','satire','manifest.json']], ['thesis', ['public','thesis','manifest.json']]]) {
    const f = path.join(process.cwd(), ...rel)
    let info = { exists: fs.existsSync(f) }
    if (info.exists) {
      try {
        const raw = fs.readFileSync(f, 'utf8')
        info.bytes = raw.length
        const arr = JSON.parse(raw)
        info.count = Array.isArray(arr) ? arr.length : -1
        info.newestTs = Array.isArray(arr) && arr.length ? arr[arr.length-1].ts : null
        info.newestId = Array.isArray(arr) && arr.length ? arr[arr.length-1].id : null
      } catch (e) { info.error = String(e).slice(0, 200) }
    }
    out[label + 'File'] = info
  }
  const kv = await getKV()
  out.hasKV = !!kv
  try { out.satireTotalBefore = await getPostsTotal('satire') } catch (e) { out.satireTotalBefore = 'err' }
  try { out.thesisTotalBefore = await getPostsTotal('thesis') } catch (e) { out.thesisTotalBefore = 'err' }
  // load files and sync
  let satirePosts = [], thesisPosts = []
  try {
    const f = path.join(process.cwd(), 'public', 'satire', 'manifest.json')
    if (fs.existsSync(f)) satirePosts = JSON.parse(fs.readFileSync(f, 'utf8')).map(p => ({...p, type: 'satire'}))
  } catch {}
  try {
    const f = path.join(process.cwd(), 'public', 'thesis', 'manifest.json')
    if (fs.existsSync(f)) thesisPosts = JSON.parse(fs.readFileSync(f, 'utf8')).map(p => ({...p, type: 'thesis'}))
  } catch {}
  try {
    out.added = await syncUnifiedFromFiles({ thesisPosts, satirePosts })
  } catch (e) { out.syncError = String(e).slice(0, 300) }
  try { out.satireTotalAfter = await getPostsTotal('satire') } catch {}
  try { out.thesisTotalAfter = await getPostsTotal('thesis') } catch {}
  try { out.newestSatireIds = await getPostIdsPage(0, 3, 'satire') } catch {}
  return res.status(200).json(out)
}
