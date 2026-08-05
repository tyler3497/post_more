// Serves satire from unified KV + file fallback, with optional pagination
import fs from 'fs'
import path from 'path'
import { getKV, getPostsPage, getPostsTotal, syncUnifiedFromFiles } from './_db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const offset = Math.max(0, parseInt(req.query.offset||'0')||0)
  const limitRaw = parseInt(req.query.limit||'20')||20
  const limit = Math.min(50, Math.max(1, limitRaw))
  const wantPaginated = req.query.offset !== undefined || req.query.limit !== undefined

  let fileSatire=[]
  try {
    const p = path.join(process.cwd(), 'public', 'satire', 'manifest.json')
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p,'utf8'))
      if (Array.isArray(data)) fileSatire = data.map(v=>({...v, type:'satire'}))
    }
  } catch {}

  const kv = await getKV()
  if (kv) {
    try {
      if (fileSatire.length) await syncUnifiedFromFiles({ satirePosts: fileSatire, thesisPosts: [] })
    } catch {}
    try {
      const total = await getPostsTotal('satire')
      const posts = await getPostsPage(offset, limit, 'satire')
      if (!wantPaginated) {
        // legacy: return array for backwards compat with old frontend fetching /api/satire as array
        // if total>0, return array directly, else file
        if (posts && posts.length>0) return res.status(200).json(posts)
        return res.status(200).json(fileSatire.sort((a,b)=>b.ts-a.ts))
      }
      if ((!posts || posts.length===0) && fileSatire.length>0) {
        const sorted = [...fileSatire].sort((a,b)=>b.ts-a.ts)
        const slice = sorted.slice(offset, offset+limit)
        return res.status(200).json({ posts: slice, total: sorted.length, hasMore: offset+limit < sorted.length, nextOffset: offset+slice.length, source:'file', type:'satire' })
      }
      return res.status(200).json({ posts: posts||[], total: total||0, hasMore: (offset+(posts?.length||0)) < (total||0), nextOffset: offset+(posts?.length||0), source:'kv', type:'satire' })
    } catch {}
  }

  if (!wantPaginated) {
    return res.status(200).json(fileSatire.sort((a,b)=>b.ts-a.ts))
  }
  const sorted=[...fileSatire].sort((a,b)=>b.ts-a.ts)
  const slice=sorted.slice(offset,offset+limit)
  return res.status(200).json({ posts: slice, total: sorted.length, hasMore: offset+limit < sorted.length, nextOffset: offset+slice.length, source:'file', type:'satire' })
}
