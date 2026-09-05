// TEMPORARY diagnostic endpoint — remove after diagnosing KV sync stall
import { getKV } from './_db.js'

const err = (e) => String((e && e.message) || e).slice(0, 400)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const out = {}
  const kv = await getKV()
  out.hasKV = !!kv
  if (!kv) return res.status(200).json(out)

  // 1. zrange without options (what syncUnifiedFromFiles uses)
  try {
    const r = await kv.zrange('post:index', 0, -1)
    out.zrangeNoOpts = { ok: true, isArray: Array.isArray(r), len: Array.isArray(r) ? r.length : typeof r, sample: Array.isArray(r) ? r.slice(0, 2) : String(r).slice(0, 100) }
  } catch (e) { out.zrangeNoOpts = { ok: false, error: err(e) } }

  // 2. zadd write test on scratch key
  const scratch = 'diag:scratch:' + Date.now()
  try {
    const n = await kv.zadd(scratch, { score: 123, member: 'm1' })
    out.zaddObj = { ok: true, returned: n }
  } catch (e) { out.zaddObj = { ok: false, error: err(e) } }
  try {
    const c = await kv.zcount(scratch, '-inf', '+inf')
    out.zcountScratch = { ok: true, count: c }
  } catch (e) { out.zcountScratch = { ok: false, error: err(e) } }
  try { await kv.del(scratch) } catch {}

  // 3. set/get test
  try {
    await kv.set(scratch + ':v', JSON.stringify({ a: 1 }))
    const v = await kv.get(scratch + ':v')
    out.setGet = { ok: true, roundtrip: !!v }
    await kv.del(scratch + ':v')
  } catch (e) { out.setGet = { ok: false, error: err(e) } }

  // 4. dbsize / info for quota clues
  try { out.dbsize = await kv.dbsize() } catch (e) { out.dbsize = err(e) }

  return res.status(200).json(out)
}
