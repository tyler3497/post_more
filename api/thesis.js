import fs from 'fs'
import path from 'path'
import { getKV, getThesisPageFromKV, getThesisTotal, syncFileThesesToKV } from './_db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const offset = Math.max(0, parseInt(req.query.offset||'0')||0)
  const limitRaw = parseInt(req.query.limit||'15')||15
  const limit = Math.min(50, Math.max(1, limitRaw))

  let filePosts = []
  try {
    const file = path.join(process.cwd(), 'public', 'thesis', 'manifest.json')
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) filePosts = data
    }
  } catch {}

  const kv = await getKV()

  if (kv) {
    try {
      if (filePosts.length) {
        await syncFileThesesToKV(filePosts)
      }
    } catch {}

    try {
      const total = await getThesisTotal()
      const posts = await getThesisPageFromKV(offset, limit)
      if ((!posts || posts.length===0) && filePosts.length>0) {
        const sorted = [...filePosts].sort((a,b)=>b.ts-a.ts)
        const slice = sorted.slice(offset, offset+limit)
        return res.status(200).json({
          posts: slice,
          total: sorted.length,
          hasMore: offset+limit < sorted.length,
          nextOffset: offset+slice.length,
          source: 'file'
        })
      }

      return res.status(200).json({
        posts: posts||[],
        total: total||0,
        hasMore: (offset + (posts?.length||0)) < (total||0),
        nextOffset: offset + (posts?.length||0),
        source: 'kv'
      })
    } catch {}
  }

  const sorted = [...filePosts].sort((a,b)=>b.ts-a.ts)
  const slice = sorted.slice(offset, offset+limit)
  return res.status(200).json({
    posts: slice,
    total: sorted.length,
    hasMore: offset+limit < sorted.length,
    nextOffset: offset+slice.length,
    source: 'file'
  })
}
