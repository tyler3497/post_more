import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*')
  try {
    const file = path.join(process.cwd(), 'public', 'thesis', 'manifest.json')
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'))
      return res.status(200).json(data.slice(-50).reverse())
    }
    return res.status(200).json([])
  } catch (e) {
    return res.status(200).json([])
  }
}
