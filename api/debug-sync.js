import fs from 'fs'
import path from 'path'
import { getKV, getPostsTotal, syncUnifiedFromFiles, getPostIdsPage } from './_db.js'

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*')
  const kv = await getKV()
  let fileThesis=[]
  try{
    const f=path.join(process.cwd(),'public','thesis','manifest.json')
    if(fs.existsSync(f)){
      fileThesis=JSON.parse(fs.readFileSync(f,'utf8'))
    }
  }catch(e){ fileThesis=[] }
  let beforeTotal=0, afterTotal=0
  try{ beforeTotal=await getPostsTotal('thesis') }catch{}
  let added=0
  try{
    added=await syncUnifiedFromFiles({thesisPosts: fileThesis, satirePosts: []})
  }catch(e){ return res.status(500).json({error: e.message, beforeTotal}) }
  try{ afterTotal=await getPostsTotal('thesis') }catch{}
  let ids=[]
  try{ ids=await getPostIdsPage(0,5,'thesis') }catch{}
  return res.status(200).json({beforeTotal, afterTotal, added, fileCount: fileThesis.length, sampleIds: ids.slice(0,3), newestFileId: fileThesis.length?fileThesis[fileThesis.length-1].id:null})
}
