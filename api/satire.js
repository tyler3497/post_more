// Serves satire manifest for Vercel - works even without build
import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*')
  try {
    const p = path.join(process.cwd(), 'public', 'satire', 'manifest.json')
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p,'utf8')
      res.setHeader('Content-Type','application/json')
      return res.status(200).send(data)
    }
  } catch {}
  return res.status(200).json([])
}
