import { useEffect, useState } from 'react'

type Reply = { id:string, anon: string, body: string, ts: number }
type Thread = { id:string, title:string, body:string, anon:string, ts:number, replies: Reply[] }

type SatirePost = { id:string, title:string, body:string, image:string, ts:number, anon:string }

const DISCLAIMER = "parody board — all posts are fictional, no real users. No harassment, no slurs, no NSFW. Text only."

const SAMPLE_USERS = ["anon#0421","anon#8832","anon#1193","anon#5520","anon#7741"]
const SAMPLE_TITLES = ["Pineapple on pizza — final verdict?","My corner store started putting fruit on everything","Best way to keep crust crispy with wet toppings?","Debate night: sweet vs savory"]
const SAMPLE_BODIES = [
 "I tried the pineapple + ham combo with a little chili flake. Sweet, salty, tiny heat. Not for everyone, but I get the appeal now. Both plain cheese and this can coexist.",
 "My take: if you like it, you like it. I'm team classic, but I won't argue with someone enjoying fruit + cheese. Food is personal.",
 "Pro tip from my own kitchen: pat the topping dry first. Way less soggy crust.",
 "We did a blind taste test with friends. Half liked it, half didn't. No fight, just preferences."
]
const SAMPLE_REPLIES = ["Same, I was skeptical but the sweet-salty thing works","Texture is what gets me, I keep it classic","Good tip on drying it first","We do half and half pies at home, keeps peace"]

function rand<T>(a:T[]){return a[Math.floor(Math.random()*a.length)]}

export default function App(){
  const [satire, setSatire] = useState<SatirePost[]>([])
  const [threads, setThreads] = useState<Thread[]>(()=>{
    try{ return JSON.parse(localStorage.getItem('pm_threads')||'[]')}catch{return []}
  })
  const [title,setTitle]=useState(""); const [body,setBody]=useState("")

  useEffect(()=>{ fetch('/satire/manifest.json').then(r=>r.json()).then(d=>setSatire(d as SatirePost[])).catch(()=>{}) },[])
  useEffect(()=>{ localStorage.setItem('pm_threads', JSON.stringify(threads)) },[threads])

  // seed with 2 threads if empty
  useEffect(()=>{
    if(threads.length===0){
      const now=Date.now()
      const seed:Thread[]=[
        {id:"t1",title:SAMPLE_TITLES[0],body:SAMPLE_BODIES[0],anon:"anon#0421",ts:now-1000000,replies:[
          {id:"r1",anon:"anon#8832",body:SAMPLE_REPLIES[0],ts:now-900000},
          {id:"r2",anon:"anon#1193",body:SAMPLE_REPLIES[1],ts:now-800000}
        ]},
        {id:"t2",title:SAMPLE_TITLES[1],body:SAMPLE_BODIES[1],anon:"anon#5520",ts:now-500000,replies:[
          {id:"r3",anon:"anon#7741",body:SAMPLE_REPLIES[2],ts:now-400000}
        ]}
      ]
      setThreads(seed)
    }
  },[])

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
  function addRandomFiction(){
    const t:Thread={id:Math.random().toString(36).slice(2),title:rand(SAMPLE_TITLES),body:rand(SAMPLE_BODIES),anon:rand(SAMPLE_USERS),ts:Date.now(),replies:[{id:Math.random().toString(36).slice(2),anon:rand(SAMPLE_USERS),body:rand(SAMPLE_REPLIES),ts:Date.now()+1000}]}
    setThreads([t,...threads].slice(0,50))
  }

  return (
    <div style={{maxWidth:900,margin:"0 auto",padding:"1rem"}}>
      <div style={{background:"#fff3cd",padding:"12px",borderRadius:8,marginBottom:16,fontWeight:600}}>⚠️ {DISCLAIMER}</div>
      <h1 style={{margin:"0.2rem 0"}}>post_more</h1>
      <p style={{color:"#666",marginTop:0}}>anonymous text board — parody / demo. No images, no accounts.</p>

      {satire.length>0 && <div style={{margin:"16px 0"}}><h2 style={{fontSize:18}}>Featured Satire (fictional)</h2>{satire.slice(-5).reverse().map(p=><div key={p.id} style={{background:"white",padding:12,borderRadius:8,margin:"8px 0"}}><div style={{fontSize:12,color:"#777"}}>{p.anon} — {new Date(p.ts).toLocaleString()} — SATIRE/PARODY</div><h3>{p.title}</h3>{p.image && <img src={p.image} style={{maxWidth:"100%",borderRadius:6}}/>}<p>{p.body}</p></div>)}</div>}<form onSubmit={addThread} style={{background:"white",padding:12,borderRadius:8,margin:"16px 0"}}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thread title (keep it kind)" style={{width:"100%",padding:8,marginBottom:8}}/>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="What’s your take on pineapple pizza? Short, fictional, respectful." style={{width:"100%",padding:8,minHeight:70}}/>
        <button type="submit" style={{marginTop:8,padding:"6px 12px"}}>Post thread (anon)</button>
        <button type="button" onClick={addRandomFiction} style={{marginLeft:8,padding:"6px 12px"}}>Add sample fiction post</button>
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

      <footer style={{marginTop:32,color:"#888",fontSize:12}}>Rule: no harassment, no slurs, no doxxing, no NSFW. This is a fictional parody demo, not a real social network. Content is client-side for demo purposes.</footer>
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
