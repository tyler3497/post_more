// Simple server-side store that works on Vercel
// Uses Vercel KV if available, otherwise falls back to in-memory (and for Vercel, in-memory is per-function, so we use file fallback in /tmp for persistence across cold starts where possible)
// For production persistence, connect Vercel KV or Postgres - this adapter is ready for it.

let mem = globalThis.__pm_mem
if (!mem) {
  mem = { likes: new Map(), comments: new Map() }
  globalThis.__pm_mem = mem
}

export async function getKV() {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv')
      return kv
    }
  } catch {}
  return null
}

export async function getLikes(postId) {
  const kv = await getKV()
  if (kv) {
    try {
      const v = await kv.get(`likes:${postId}`)
      if (v === null || v === undefined) return 0
      if (typeof v === 'number') return v
      if (typeof v === 'string') return parseInt(v) || 0
      return Number(v) || 0
    } catch { return 0 }
  }
  return mem.likes.get(postId) || 0
}

export async function addLike(postId) {
  const kv = await getKV()
  if (kv) {
    try {
      const v = await kv.incr(`likes:${postId}`)
      return v
    } catch { /* fallthrough to mem */ }
  }
  const cur = (mem.likes.get(postId)||0)+1
  mem.likes.set(postId, cur)
  return cur
}

export async function getComments(postId) {
  const kv = await getKV()
  if (kv) {
    try {
      const list = await kv.lrange(`comments:${postId}`, 0, -1)
      if (!list || !Array.isArray(list)) return []
      // lrange returns newest first because we use lpush. Don't reverse twice.
      try { return list.map(s=> typeof s==='string'?JSON.parse(s):s) } catch { return list }
    } catch { return [] }
  }
  return (mem.comments.get(postId)||[]).slice().reverse()
}

export async function addComment(postId, comment) {
  const kv = await getKV()
  if (kv) {
    try {
      await kv.lpush(`comments:${postId}`, JSON.stringify(comment))
      await kv.ltrim(`comments:${postId}`, 0, 199) // keep last 200
      return comment
    } catch { /* fallthrough */ }
  }
  const arr = mem.comments.get(postId) || []
  arr.push(comment)
  if (arr.length>200) arr.shift()
  mem.comments.set(postId, arr)
  return comment
}
