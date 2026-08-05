import fs from 'fs'
import path from 'path'
import { getKV, getPostsPage, getPostsTotal, syncUnifiedFromFiles } from './_db.js'

const ALLOWED_TYPES = new Set(['thesis','satire']) // extend here — adding a new type just needs to be added to frontend registry, backend will accept any string though

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  if (req.method==='OPTIONS') return res.status(200).end()

  const offset = Math.max(0, parseInt(req.query.offset||'0')||0)
  const limitRaw = parseInt(req.query.limit||'5')||5
  const limit = Math.min(50, Math.max(1, limitRaw))
  const typeRaw = (req.query.type||'').toString().trim().toLowerCase()
  let typeFilter = null
  if (typeRaw && typeRaw !== 'all') {
    // allow any type for future extensibility; we keep allowed set for validation but don't reject unknowns
    typeFilter = typeRaw
  }

  // load file fallbacks
  let fileThesis=[]
  let fileSatire=[]
  try {
    const f = path.join(process.cwd(),'public','thesis','manifest.json')
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f,'utf8')
      const d = JSON.parse(raw)
      if (Array.isArray(d)) fileThesis = d
    }
  } catch {}
  try {
    const f = path.join(process.cwd(),'public','satire','manifest.json')
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f,'utf8')
      const d = JSON.parse(raw)
      if (Array.isArray(d)) fileSatire = d.map(p=>({...p, type:'satire'}))
    }
  } catch {}

  const kv = await getKV()

  if (kv) {
    try {
      if (fileThesis.length || fileSatire.length) {
        await syncUnifiedFromFiles({ thesisPosts: fileThesis, satirePosts: fileSatire })
      }
    } catch {}

    try {
      const total = await getPostsTotal(typeFilter)
      const posts = await getPostsPage(offset, limit, typeFilter)
      if ((!posts || posts.length===0) && (fileThesis.length || fileSatire.length)) {
        // fallback to file merge if KV empty
        let merged=[]
        if (!typeFilter || typeFilter==='thesis') merged = merged.concat(fileThesis.map(p=>({...p, type:'thesis'})))
        if (!typeFilter || typeFilter==='satire') merged = merged.concat(fileSatire.map(p=>({...p, type:'satire'})))
        merged.sort((a,b)=>b.ts-a.ts)
        const slice = merged.slice(offset, offset+limit)
        return res.status(200).json({
          posts: slice,
          total: merged.length,
          hasMore: offset+limit < merged.length,
          nextOffset: offset+slice.length,
          source: 'file',
          type: typeFilter || 'all'
        })
      }
      return res.status(200).json({
        posts: posts||[],
        total: total||0,
        hasMore: (offset + (posts?.length||0)) < (total||0),
        nextOffset: offset + (posts?.length||0),
        source: 'kv',
        type: typeFilter || 'all'
      })
    } catch {}
  }

  // file-only fallback
  let merged=[]
  if (!typeFilter || typeFilter==='thesis') merged = merged.concat(fileThesis.map(p=>({...p, type:'thesis'})))
  if (!typeFilter || typeFilter==='satire') merged = merged.concat(fileSatire.map(p=>({...p, type:'satire'})))
  merged.sort((a,b)=>b.ts-a.ts)
  const slice = merged.slice(offset, offset+limit)
  return res.status(200).json({
    posts: slice,
    total: merged.length,
    hasMore: offset+limit < merged.length,
    nextOffset: offset+slice.length,
    source: 'file',
    type: typeFilter || 'all'
  })
}
