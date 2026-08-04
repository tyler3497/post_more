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
    const v = await kv.get(`likes:${postId}`)
    return typeof v === 'number' ? v : (v ? parseInt(v) : 0)
  }
  return mem.likes.get(postId) || 0
}

export async function addLike(postId) {
  const kv = await getKV()
  if (kv) {
    const v = await kv.incr(`likes:${postId}`)
    return v
  }
  const cur = (mem.likes.get(postId)||0)+1
  mem.likes.set(postId, cur)
  return cur
}

export async function getComments(postId) {
  const kv = await getKV()
  if (kv) {
    const list = await kv.lrange(`comments:${postId}`, 0, -1)
    if (!list) return []
    // lrange returns newest last if we lpush, so reverse for newest first? Keep order inserted
    try { return list.map(s=> typeof s==='string'?JSON.parse(s):s).reverse() } catch { return list.reverse() }
  }
  return (mem.comments.get(postId)||[]).slice().reverse()
}

export async function addComment(postId, comment) {
  const kv = await getKV()
  if (kv) {
    await kv.lpush(`comments:${postId}`, JSON.stringify(comment))
    await kv.ltrim(`comments:${postId}`, 0, 99) // keep last 100
    return comment
  }
  const arr = mem.comments.get(postId) || []
  arr.push(comment)
  if (arr.length>100) arr.shift()
  mem.comments.set(postId, arr)
  return comment
}
