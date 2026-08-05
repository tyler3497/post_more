// Simple server-side store that works on Vercel
// Uses Vercel KV if available, otherwise falls back to in-memory (and for Vercel, in-memory is per-function, so we use file fallback in /tmp for persistence across cold starts where possible)
// For production persistence, connect Vercel KV or Postgres - this adapter is ready for it.

let mem = globalThis.__pm_mem
if (!mem) {
  mem = { likes: new Map(), comments: new Map(), thesis: new Map() }
  globalThis.__pm_mem = mem
}
if (!mem.thesis) mem.thesis = new Map()

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

// ---- Thesis persistent store ----
const THESIS_INDEX = 'thesis:index'
const THESIS_PREFIX = 'thesis:post:'

export async function saveThesisPost(post) {
  const kv = await getKV()
  if (!kv) {
    mem.thesis.set(post.id, post)
    return true
  }
  try {
    await kv.set(`${THESIS_PREFIX}${post.id}`, JSON.stringify(post))
  } catch {}
  try {
    try {
      await kv.zadd(THESIS_INDEX, { score: post.ts, member: post.id })
    } catch {
      try {
        // alternate signature (score, member)
        await kv.zadd(THESIS_INDEX, post.ts, post.id)
      } catch {}
    }
  } catch {}
  return true
}

export async function getThesisPostById(id) {
  const kv = await getKV()
  if (kv) {
    try {
      const raw = await kv.get(`${THESIS_PREFIX}${id}`)
      if (!raw) return null
      if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return raw } }
      return raw
    } catch { return null }
  }
  return mem.thesis.get(id) || null
}

export async function getThesisTotal() {
  const kv = await getKV()
  if (!kv) {
    // fallback to mem + file? file handled in API
    return mem.thesis.size
  }
  try {
    const c = await kv.zcard(THESIS_INDEX)
    return typeof c === 'number' ? c : 0
  } catch {
    try {
      const count = await kv.zcount(THESIS_INDEX, '-inf', '+inf')
      return typeof count === 'number' ? count : 0
    } catch { return 0 }
  }
}

export async function getThesisIdsPage(offset, limit) {
  const kv = await getKV()
  if (!kv) return []
  let ids = []
  try {
    try {
      ids = await kv.zrange(THESIS_INDEX, offset, offset+limit-1, { rev: true })
    } catch {
      try {
        ids = await kv.zrange(THESIS_INDEX, offset, offset+limit-1, { rev: true, byScore: false } )
      } catch {
        try {
          if (kv.zrevrange) {
            ids = await kv.zrevrange(THESIS_INDEX, offset, offset+limit-1)
          } else throw new Error('no rev')
        } catch {
          const all = await kv.zrange(THESIS_INDEX, 0, -1)
          if (Array.isArray(all)) {
            const rev = [...all].reverse()
            ids = rev.slice(offset, offset+limit)
          } else ids = []
        }
      }
    }
  } catch { ids = [] }
  // upstash may return withScores interleaved? ensure only strings
  if (Array.isArray(ids) && ids.length>0 && typeof ids[0]!=='string') {
    // if objects? filter
    ids = ids.filter((x,i)=> typeof x==='string')
  }
  return Array.isArray(ids) ? ids : []
}

export async function getThesisPageFromKV(offset, limit) {
  const kv = await getKV()
  if (!kv) return []
  const ids = await getThesisIdsPage(offset, limit)
  if (!ids || ids.length===0) return []
  const posts = []
  // Try mget if available
  try {
    if (kv.mget) {
      const keys = ids.map(id=>`${THESIS_PREFIX}${id}`)
      const raw = await kv.mget(...keys)
      if (Array.isArray(raw)) {
        for (let r of raw) {
          if (!r) continue
          if (typeof r==='string') { try { posts.push(JSON.parse(r)) } catch { } }
          else posts.push(r)
        }
        return posts
      }
    }
  } catch {}
  // fallback sequential get
  for (let id of ids) {
    const p = await getThesisPostById(id)
    if (p) posts.push(p)
  }
  return posts
}

export async function syncFileThesesToKV(filePosts) {
  const kv = await getKV()
  if (!kv || !Array.isArray(filePosts) || filePosts.length===0) return 0
  let added = 0
  try {
    // get existing ids to avoid dup
    let existing = []
    try {
      existing = await kv.zrange(THESIS_INDEX, 0, -1)
    } catch { existing = [] }
    const set = new Set(Array.isArray(existing)?existing:[])
    for (let p of filePosts) {
      if (!p || !p.id) continue
      if (set.has(p.id)) continue
      await saveThesisPost(p)
      added++
    }
  } catch { /* ignore */ }
  return added
}
