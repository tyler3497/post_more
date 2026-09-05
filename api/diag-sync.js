// TEMPORARY cleanup endpoint — deletes legacy duplicate thesis:post:* keys (dead weight).
// Every thesis body is stored twice: post:post:<id> (live) and thesis:post:<id> (legacy, unread by any code).
// DB is at 256MB capacity quota; this frees ~half the DB. REMOVE after use.
import { getKV } from './_db.js'

const err = (e) => String((e && e.message) || e).slice(0, 300)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const out = {}
  const kv = await getKV()
  if (!kv) return res.status(500).json({ error: 'no kv' })

  // 1. verify a sample legacy key is a true duplicate of the live key
  try {
    const ids = await kv.zrange('post:index:thesis', 0, 0, { rev: true })
    const id = Array.isArray(ids) && ids[0]
    if (id) {
      const [live, legacy] = await kv.mget(`post:post:${id}`, `thesis:post:${id}`)
      out.sampleId = id
      out.legacyExists = !!legacy
      let lj = null, gj = null
      try { lj = typeof live === 'string' ? JSON.parse(live) : live } catch {}
      try { gj = typeof legacy === 'string' ? JSON.parse(legacy) : legacy } catch {}
      out.liveKeys = lj ? Object.keys(lj) : null
      out.legacyKeys = gj ? Object.keys(gj) : null
      if (lj && gj) {
        const diffs = []
        for (const k of new Set([...Object.keys(lj), ...Object.keys(gj)])) {
          const a = lj[k], b = gj[k]
          const sa = typeof a === 'string' ? a.length : JSON.stringify(a)?.length
          const sb = typeof b === 'string' ? b.length : JSON.stringify(b)?.length
          if (sa !== sb || a !== b) diffs.push(`${k}: live_len=${sa} legacy_len=${sb} live_trunc=${gj._truncated} legacy_trunc=${gj._truncated}`)
        }
        out.fieldDiffs = diffs.slice(0, 10)
        out.liveTruncated = !!lj._truncated
        out.legacyTruncated = !!gj._truncated
      }
      out.isDuplicate = !!live && !!legacy && live === legacy
      if (!out.isDuplicate) return res.status(200).json({ ...out, aborted: 'sample is not an exact duplicate' })
    }
  } catch (e) { return res.status(500).json({ error: 'sample check failed: ' + err(e) }) }

  // 2. scan all legacy keys
  let cursor = 0, keys = []
  try {
    do {
      const [next, batch] = await kv.scan(cursor, { match: 'thesis:post:*', count: 1000 })
      cursor = Number(next)
      if (Array.isArray(batch)) keys.push(...batch)
    } while (cursor !== 0)
  } catch (e) { return res.status(500).json({ error: 'scan failed: ' + err(e) }) }
  out.legacyKeyCount = keys.length

  // 3. delete in batches
  let deleted = 0
  for (let i = 0; i < keys.length; i += 500) {
    try {
      deleted += await kv.del(...keys.slice(i, i + 500))
    } catch (e) { out.deleteError = err(e); break }
  }
  out.deleted = deleted

  // 4. drop legacy thesis:index zset (unread duplicate of post:index:thesis)
  try { out.legacyIndexRemoved = await kv.del('thesis:index') } catch (e) { out.legacyIndexError = err(e) }

  // 5. probe that writes work again
  try {
    await kv.set('diag:probe', '1')
    await kv.del('diag:probe')
    out.writesWork = true
  } catch (e) { out.writesWork = false; out.writeError = err(e) }

  try { out.dbsize = await kv.dbsize() } catch {}
  return res.status(200).json(out)
}
