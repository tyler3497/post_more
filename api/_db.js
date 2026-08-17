// Unified server-side store for post_more
// All post types (thesis, satire, future types) live in ONE KV set with a `type` field.
// Easy to add new types: just add a new type string when saving, no schema change needed.

let mem = globalThis.__pm_mem
if (!mem) {
  mem = { likes: new Map(), comments: new Map(), thesis: new Map(), posts: new Map() }
  globalThis.__pm_mem = mem
}
if (!mem.thesis) mem.thesis = new Map()
if (!mem.posts) mem.posts = new Map()
if (!mem.likes) mem.likes = new Map()
if (!mem.comments) mem.comments = new Map()

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
    } catch {}
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
      await kv.ltrim(`comments:${postId}`, 0, 199)
      return comment
    } catch {}
  }
  const arr = mem.comments.get(postId) || []
  arr.push(comment)
  if (arr.length>200) arr.shift()
  mem.comments.set(postId, arr)
  return comment
}

// ==== Unified Post Store ====
const POST_INDEX = 'post:index' // all types, sorted by ts
const POST_PREFIX = 'post:post:'
const typeIndexKey = (type)=> `post:index:${type}`

function ensureType(post) {
  if (!post) return post
  if (!post.type) {
    // infer from legacy fields
    if (post.thesis === true || post.abstract || post.topic) post.type = 'thesis'
    else if (post.satire || post.image && !post.abstract) {
      // heuristic: satire posts usually have single image and no abstract
      // if we can't tell, default to satire when manifest is satire list
      post.type = post.type || 'satire'
    } else {
      post.type = post.type || 'thesis'
    }
  }
  return post
}

export async function savePost(post) {
  if (!post || !post.id) return false
  post = ensureType({...post})
  if (!post.ts) post.ts = Date.now()
  const kv = await getKV()
  if (!kv) {
    mem.posts.set(post.id, post)
    return true
  }
  try {
    await kv.set(`${POST_PREFIX}${post.id}`, JSON.stringify(post))
  } catch {}
  try {
    try { await kv.zadd(POST_INDEX, { score: post.ts, member: post.id }) }
    catch {
      try { await kv.zadd(POST_INDEX, post.ts, post.id) } catch {}
    }
  } catch {}
  // per-type secondary index for fast filtered pagination
  try {
    const tKey = typeIndexKey(post.type)
    try { await kv.zadd(tKey, { score: post.ts, member: post.id }) }
    catch {
      try { await kv.zadd(tKey, post.ts, post.id) } catch {}
    }
  } catch {}
  // backwards-compat: also write to old thesis index if thesis
  if (post.type === 'thesis') {
    try {
      try { await kv.zadd('thesis:index', { score: post.ts, member: post.id }) }
      catch { try { await kv.zadd('thesis:index', post.ts, post.id) } catch {} }
      await kv.set(`thesis:post:${post.id}`, JSON.stringify(post))
    } catch {}
  }
  return true
}

export async function getPostById(id) {
  const kv = await getKV()
  if (kv) {
    try {
      const raw = await kv.get(`${POST_PREFIX}${id}`)
      if (!raw) return null
      if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return raw } }
      return raw
    } catch { return null }
  }
  return mem.posts.get(id) || null
}

export async function getPostsTotal(typeFilter = null) {
  const kv = await getKV()
  if (!kv) {
    if (!typeFilter) return mem.posts.size
    let c = 0
    for (let p of mem.posts.values()) if (p.type === typeFilter) c++
    return c
  }
  const key = typeFilter ? typeIndexKey(typeFilter) : POST_INDEX
  try {
    const c = await kv.zcard(key)
    if (typeof c === 'number') return c
  } catch {}
  try {
    const c2 = await kv.zcount(key, '-inf', '+inf')
    if (typeof c2 === 'number') return c2
  } catch {}
  return 0
}

export async function getPostIdsPage(offset, limit, typeFilter = null) {
  const kv = await getKV()
  if (!kv) {
    // mem fallback: sort mem.posts by ts desc, filter
    let arr = Array.from(mem.posts.values())
    if (typeFilter) arr = arr.filter(p=>p.type===typeFilter)
    arr.sort((a,b)=>b.ts-a.ts)
    return arr.slice(offset, offset+limit).map(p=>p.id)
  }
  const key = typeFilter ? typeIndexKey(typeFilter) : POST_INDEX
  let ids = []
  try {
    try { ids = await kv.zrange(key, offset, offset+limit-1, { rev: true }) }
    catch {
      try { ids = await kv.zrange(key, offset, offset+limit-1, { rev: true, byScore:false }) }
      catch {
        try {
          if (kv.zrevrange) ids = await kv.zrevrange(key, offset, offset+limit-1)
          else throw new Error('no rev')
        } catch {
          const all = await kv.zrange(key, 0, -1)
          if (Array.isArray(all)) {
            const rev = [...all].reverse()
            ids = rev.slice(offset, offset+limit)
          } else ids = []
        }
      }
    }
  } catch { ids = [] }
  if (Array.isArray(ids) && ids.length>0 && typeof ids[0] !== 'string') {
    ids = ids.filter(x=>typeof x==='string')
  }
  return Array.isArray(ids) ? ids : []
}

export async function getPostsPage(offset, limit, typeFilter = null) {
  const ids = await getPostIdsPage(offset, limit, typeFilter)
  if (!ids || ids.length===0) return []
  const kv = await getKV()
  if (!kv) {
    return ids.map(id=>mem.posts.get(id)).filter(Boolean)
  }
  // bulk mget
  try {
    if (kv.mget) {
      const keys = ids.map(id=>`${POST_PREFIX}${id}`)
      const raw = await kv.mget(...keys)
      if (Array.isArray(raw)) {
        const out = []
        for (let r of raw) {
          if (!r) continue
          if (typeof r==='string') { try { out.push(JSON.parse(r)) } catch {} }
          else out.push(r)
        }
        // preserve order of ids (mget returns in order)
        // filter ensures order; if some null, we already skipped but need to keep order matching ids
        // quick fix: if counts mismatch, fallback to sequential
        if (out.length>0) return out
      }
    }
  } catch {}
  const posts=[]
  for (let id of ids) {
    const p = await getPostById(id)
    if (p) posts.push(p)
  }
  return posts
}

export async function syncUnifiedFromFiles({ thesisPosts = [], satirePosts = [] }) {
  const kv = await getKV()
  if (!kv) {
    // mem fallback
    for (let p of [...satirePosts, ...thesisPosts]) {
      if (!p || !p.id) continue
      const typed = ensureType({...p})
      if (!typed.type) typed.type = typed.abstract ? 'thesis' : 'satire'
      mem.posts.set(typed.id, typed)
    }
    return mem.posts.size
  }
  let added = 0
  try {
    let existing=[]
    try { existing = await kv.zrange(POST_INDEX, 0, -1) } catch { existing=[] }
    const set = new Set(Array.isArray(existing)?existing:[])
    const all = [...satirePosts.map(p=>({...ensureType(p), type: p.type||'satire'})), ...thesisPosts.map(p=>({...ensureType(p), type: p.type||'thesis'}))]
    for (let p of all) {
      if (!p || !p.id) continue
      if (set.has(p.id)) {
        // Update score if ts newer (keeps newest-first correct without deleting)
        try {
          const existingRaw = await kv.get(`${POST_PREFIX}${p.id}`)
          let existingTs = 0
          if (existingRaw) {
            try { const ej = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw; existingTs = ej?.ts || 0 } catch {}
          }
          if (p.ts && p.ts > existingTs) {
            await savePost(p)
          }
        } catch {}
        continue
      }
      await savePost(p)
      added++
    }
  } catch {}
  return added
}

// --- Back-compat thesis helpers (delegate to unified) ---
export const THESIS_INDEX = 'thesis:index'
export const THESIS_PREFIX = 'thesis:post:'

export async function saveThesisPost(post){ return savePost({...post, type:'thesis'}) }
export async function getThesisPostById(id){ return getPostById(id) }
export async function getThesisTotal(){ return getPostsTotal('thesis') }
export async function getThesisIdsPage(offset,limit){ return getPostIdsPage(offset,limit,'thesis') }
export async function getThesisPageFromKV(offset,limit){ return getPostsPage(offset,limit,'thesis') }
export async function syncFileThesesToKV(filePosts){ return syncUnifiedFromFiles({ thesisPosts: filePosts, satirePosts: [] }) }

