import { getLikes, addLike } from './_db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const postId = req.query.postId || (req.body && req.body.postId)
  if (!postId) return res.status(400).json({error:'postId required'})

  if (req.method === 'GET') {
    const count = await getLikes(postId)
    return res.status(200).json({ postId, likes: count })
  }
  if (req.method === 'POST') {
    const count = await addLike(postId)
    return res.status(200).json({ postId, likes: count })
  }
  return res.status(405).json({error:'method not allowed'})
}
