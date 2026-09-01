export default function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*')
  return res.status(200).json({hasUrl: !!process.env.KV_REST_API_URL, hasToken: !!process.env.KV_REST_API_TOKEN, urlPrefix: process.env.KV_REST_API_URL ? process.env.KV_REST_API_URL.slice(0,30) : null})
}
