// TEMPORARY cleanup endpoint — deletes legacy duplicate thesis:post:* keys (dead weight).
// Every thesis body is stored twice: post:post:<id> (live, served by API) and thesis:post:<id> (legacy, unread by any code).
// DB hit the 256MB Upstash quota on ~Aug 31, freezing ALL writes. This frees ~half the DB.
// Safety: only deletes a legacy key when its live twin post:post:<id> EXISTS. REMOVE after use.
import { getKV } from './_db.js'

const err = (e) => String((e && e.message) || e).slice(0, 300)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const out = {}
  const kv = await getKV()
  if (!kv) return res.status(500).json({ error: 'no kv' })

  // 1. scan all legacy keys
  let cursor = 0, keys = []
  try {
    do {
      const [next, batch] = await kv.scan(cursor, { match: 'thesis:post:*', count: 1000 })
      cursor = Number(next)
      if (Array.isArray(batch)) keys.push(...batch)
    } while (cursor !== 0)
  } catch (e) { return res.status(500).json({ error: 'scan failed: ' + err(e) }) }
  out.legacyKeyCount = keys.length

  // 2. for each legacy key, verify live twin exists; delete only those with twins
  let deleted = 0, skipped = 0
  for (let i = 0; i < keys.length; i += 200) {
    const batch = keys.slice(i, i + 200)
    let exists = []
    try {
      // pipeline exists checks
      const pipe = kv.pipeline()
      for (const k of batch) {
        const id = k.slice('thesis:post:'.length)
        pipe.exists(`post:post:${id}`)
      }
      exists = await pipe.exec()
    } catch (e) { out.existsError = err(e); break }
    const toDelete = batch.filter((_, j) => Number(exists[j]) === 1)
    skipped += batch.length - toDelete.length
    for (let j = 0; j < toDelete.length; j += 500) {
      try { deleted += await kv.del(...toDelete.slice(j, j + 500)) }
      catch (e) { out.deleteError = err(e); break }
    }
    if (out.deleteError) break
  }
  out.deleted = deleted
  out.skippedNoTwin = skipped

  // 3. drop legacy thesis:index zset (unread duplicate of post:index:thesis)
  try { out.legacyIndexRemoved = await kv.del('thesis:index') } catch (e) { out.legacyIndexError = err(e) }

  // 4. probe that writes work again
  try {
    await kv.set('diag:probe', '1')
    await kv.del('diag:probe')
    out.writesWork = true
  } catch (e) { out.writesWork = false; out.writeError = err(e) }

  try { out.dbsize = await kv.dbsize() } catch {}
  return res.status(200).json(out)
}
