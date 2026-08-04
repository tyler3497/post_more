import { getComments, addComment } from './_db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const postId = req.query.postId
  if (!postId) return res.status(400).json({error:'postId required'})

  if (req.method === 'GET') {
    const list = await getComments(postId)
    return res.status(200).json({ postId, comments: list })
  }
  if (req.method === 'POST') {
    const { anon, body } = req.body || {}
    if (!body || typeof body !== 'string' || !body.trim()) return res.status(400).json({error:'body required'})
    if (body.length>600) return res.status(400).json({error:'too long, max 600'})
    const comment = {
      id: Math.random().toString(36).slice(2),
      anon: (anon && typeof anon==='string' ? anon.slice(0,30) : `anon#${Math.floor(1000+Math.random()*9000)}`),
      body: body.slice(0,600),
      ts: Date.now()
    }
    await addComment(postId, comment)
    return res.status(200).json({ ok:true, comment })
  }
  return res.status(405).json({error:'method not allowed'})
}
