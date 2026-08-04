import { useEffect, useState } from 'react'

type Reply = { id:string, anon: string, body: string, ts: number }
type Thread = { id:string, title:string, body:string, anon:string, ts:number, replies: Reply[] }
type SatirePost = { id:string, title:string, body:string, image:string, ts:number, anon:string }
type Comment = { id:string, anon:string, body:string, ts:number }

const DISCLAIMER = "parody board — all posts are fictional, no real users. No harassment, no slurs, no NSFW. Text only."

const SAMPLE_TITLES = ["Pineapple on pizza — final verdict?","My corner store started putting fruit on everything","Best way to keep crust crispy with wet toppings?","Debate night: sweet vs savory"]
const SAMPLE_BODIES = [
 "I tried the pineapple + ham combo with a little chili flake. Sweet, salty, tiny heat. Not for everyone, but I get the appeal now.",
 "My take: if you like it, you like it. I'm team classic, but I won't argue with someone enjoying fruit + cheese.",
 "Pro tip: pat the topping dry first. Way less soggy crust.",
 "We did a blind taste test. Half liked it, half didn't. No fight, just preferences."
]
const SAMPLE_REPLIES = ["Same, I was skeptical but the sweet-salty thing works","Texture is what gets me, I keep it classic","Good tip on drying it first"]

function rand<T>(a:T[]){return a[Math.floor(Math.random()*a.length)]}

export default function App(){
  const [satire, setSatire] = useState<SatirePost[]>([])
  const [threads, setThreads] = useState<Thread[]>(()=>{
    try{ return JSON.parse(localStorage.getItem('pm_threads')||'[]')}catch{return []}
  })
  const [title,setTitle]=useState(""); const [body,setBody]=useState("")
  const [likes, setLikes] = useState<Record<string,number>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [cmtTxt, setCmtTxt] = useState<Record<string,string>>({})

  useEffect(()=>{
    // Load satire - try static file first, fallback to api
    fetch('/satire/manifest.json').then(r=>r.ok?r.json():Promise.reject()).then(d=>setSatire(d as SatirePost[])).catch(()=>{
      fetch('/api/satire').then(r=>r.json()).then(d=>setSatire(d)).catch(()=>{})
    })
  },[])

  useEffect(()=>{ localStorage.setItem('pm_threads', JSON.stringify(threads)) },[threads])

  useEffect(()=>{
    if(threads.length===0){
      const now=Date.now()
      setThreads([
        {id:"t1",title:SAMPLE_TITLES[0],body:SAMPLE_BODIES[0],anon:"anon#0421",ts:now-1000000,replies:[
          {id:"r1",anon:"anon#8832",body:SAMPLE_REPLIES[0],ts:now-900000}
        ]},
        {id:"t2",title:SAMPLE_TITLES[1],body:SAMPLE_BODIES[1],anon:"anon#5520",ts:now-500000,replies:[]}
      ])
    }
  },[])

  // Load likes/comments for visible satire posts
  useEffect(()=>{
    satire.forEach(async p=>{
      try{
        const lr = await fetch(`/api/likes?postId=${p.id}`)
        if(lr.ok){ const d=await lr.json(); setLikes(s=>({...s,[p.id]:d.likes})) }
      }catch{}
      try{
        const cr = await fetch(`/api/comments?postId=${p.id}`)
        if(cr.ok){ const d=await cr.json(); setComments(s=>({...s,[p.id]:d.comments})) }
      }catch{}
    })
  },[satire])

  function addThread(e:React.FormEvent){
    e.preventDefault()
    if(!title.trim()||!body.trim()) return
    const t:Thread={id:Math.random().toString(36).slice(2),title:title.slice(0,120),body:body.slice(0,1000),anon:`anon#${Math.floor(1000+Math.random()*9000)}`,ts:Date.now(),replies:[]}
    setThreads([t,...threads].slice(0,50))
    setTitle(""); setBody("")
  }
  function addReply(tid:string, txt:string){
    if(!txt.trim()) return
    setThreads(threads.map(t=> t.id===tid ? {...t,replies:[...t.replies,{id:Math.random().toString(36).slice(2),anon:`anon#${Math.floor(1000+Math.random()*9000)}`,body:txt.slice(0,600),ts:Date.now()}].slice(-20)} : t))
  }

  async function likePost(id:string){
    setLikes(s=>({...s,[id]:(s[id]||0)+1}))
    try{ const r=await fetch(`/api/likes?postId=${id}`,{method:'POST'}); if(r.ok){ const d=await r.json(); setLikes(s=>({...s,[id]:d.likes})) } }catch{ }
  }
  async function postComment(id:string){
    const txt = (cmtTxt[id]||"").trim()
    if(!txt) return
    const tmp:Comment = {id:Math.random().toString(36).slice(2),anon:`anon#${Math.floor(1000+Math.random()*9000)}`,body:txt.slice(0,600),ts:Date.now()}
    setComments(s=>({...s,[id]:[tmp,...(s[id]||[])]}))
    setCmtTxt(s=>({...s,[id]:""}))
    try{
      const r=await fetch(`/api/comments?postId=${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:txt})})
      if(r.ok){ const d=await r.json(); setComments(s=>({...s,[id]:[d.comment,...(s[id]||[]).filter(c=>c.id!==tmp.id)]})) }
    }catch{}
  }

  return (
    <div style={{maxWidth:900,margin:"0 auto",padding:"1rem"}}>
      <div style={{background:"#fff3cd",padding:"12px",borderRadius:8,marginBottom:16,fontWeight:600}}>⚠️ {DISCLAIMER}</div>
      <h1 style={{margin:"0.2rem 0"}}>post_more</h1>
      <p style={{color:"#666",marginTop:0}}>anonymous text board — parody / demo. Vercel-ready with server comments & likes.</p>

      {satire.length>0 && <div style={{margin:"16px 0"}}><h2 style={{fontSize:18}}>Featured Satire (fictional — parody)</h2>{satire.slice(-10).reverse().map(p=>(
        <div key={p.id} style={{background:"white",padding:12,borderRadius:8,margin:"12px 0"}}>
          <div style={{fontSize:12,color:"#777"}}>{p.anon} — {new Date(p.ts).toLocaleString()} — SATIRE/PARODY</div>
          <h3 style={{margin:"6px 0"}}>{p.title}</h3>
          {p.image && <img src={p.image} style={{maxWidth:"100%",borderRadius:6,margin:"8px 0"}} alt="satire illustration"/>}
          <p>{p.body}</p>
          <div style={{display:"flex",gap:12,alignItems:"center",marginTop:8}}>
            <button onClick={()=>likePost(p.id)} style={{padding:"4px 10px"}}>❤️ Like {likes[p.id] ? `(${likes[p.id]})` : ""}</button>
            <span style={{fontSize:12,color:"#666"}}>{comments[p.id]?.length||0} comments</span>
          </div>
          <div style={{marginTop:8,display:"flex",gap:6}}>
            <input value={cmtTxt[p.id]||""} onChange={e=>setCmtTxt(s=>({...s,[p.id]:e.target.value}))} placeholder="Add a comment (kept kind)" style={{flex:1,padding:6}}/>
            <button onClick={()=>postComment(p.id)}>Post</button>
          </div>
          <div style={{marginLeft:8,borderLeft:"2px solid #eee",paddingLeft:10,marginTop:8}}>
            {(comments[p.id]||[]).map(c=><div key={c.id} style={{margin:"6px 0"}}><b>{c.anon}</b> <span style={{color:"#777",fontSize:11}}>{new Date(c.ts).toLocaleString()}</span><div>{c.body}</div></div>)}
          </div>
        </div>
      ))}</div>}

      <form onSubmit={addThread} style={{background:"white",padding:12,borderRadius:8,margin:"16px 0"}}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thread title (keep it kind)" style={{width:"100%",padding:8,marginBottom:8}}/>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="What’s your take? Short, fictional, respectful." style={{width:"100%",padding:8,minHeight:70}}/>
        <button type="submit" style={{marginTop:8,padding:"6px 12px"}}>Post thread (anon)</button>
      </form>

      <div>
        {threads.map(t=>(
          <div key={t.id} style={{background:"white",padding:12,borderRadius:8,margin:"12px 0"}}>
            <div style={{fontSize:13,color:"#777"}}>{t.anon} — {new Date(t.ts).toLocaleString()}</div>
            <h3 style={{margin:"6px 0"}}>{t.title}</h3>
            <p>{t.body}</p>
            <div style={{marginLeft:16,borderLeft:"2px solid #eee",paddingLeft:12}}>
              {t.replies.map(r=>(<div key={r.id} style={{margin:"8px 0"}}><span style={{fontWeight:600}}>{r.anon}</span> <span style={{color:"#777",fontSize:12}}>{new Date(r.ts).toLocaleString()}</span><div>{r.body}</div></div>))}
              <ReplyBox onSend={txt=>addReply(t.id,txt)}/>
            </div>
          </div>
        ))}
      </div>

      <footer style={{marginTop:32,color:"#888",fontSize:12}}>Parody/demo. No harassment, no slurs, no doxxing, no NSFW. Server-side likes/comments use Vercel KV when configured, else in-memory on function — connect KV in Vercel dashboard for persistence.</footer>
    </div>
  )
}

function ReplyBox({onSend}:{onSend:(s:string)=>void}){
  const [txt,setTxt]=useState("")
  return <form onSubmit={e=>{e.preventDefault(); onSend(txt); setTxt("")}} style={{display:"flex",gap:6,marginTop:8}}>
    <input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Reply anonymously…" style={{flex:1,padding:6}}/>
    <button>Reply</button>
  </form>
}
