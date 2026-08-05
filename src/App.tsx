import { useEffect, useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Reply = { id:string, anon:string, body:string, ts:number }
type Thread = { id:string, title:string, body:string, anon:string, ts:number, replies: Reply[] }
type Comment = { id:string, anon:string, body:string, ts:number }

// Unified post — all server posts share this shape, differentiated by `type`
// Adding a new type is just adding a new string here and in POST_TYPES, no schema change.
export type UnifiedPost = {
  id:string
  type: string // 'thesis' | 'satire' | future types like 'news', 'research', etc.
  title:string
  body:string
  ts:number
  anon:string
  // thesis extras
  abstract?:string
  images?:string[]
  image?:string
  sources?: {title:string, url:string, authors?:string, year?:number}[]
  topic?:string
  thesis?:boolean
  // satire extras use same image field
  satire?:boolean
}

const DISCLAIMER = "parody board — all posts are fictional, no real users. No harassment, no slurs, no NSFW. Text only."
const PAGE_SIZE = 5

// Registry of post types — add a new type here and it automatically gets a tab, badge, and filtering.
// Example future: { id:'news', label:'News', badge:'NEWS', fg:'#0e7490', bg:'#cffafe' }
export const POST_TYPES = [
  { id:'thesis', label:'Thesis 🎓', badge:'THESIS', fg:'#4338ca', bg:'#eef2ff' },
  { id:'satire', label:'Satire', badge:'SATIRE/PARODY', fg:'#a16207', bg:'#fef3c7' },
] as const

type FilterType = 'all' | typeof POST_TYPES[number]['id'] | 'threads'
const SERVER_FILTERS = ['all', ...POST_TYPES.map(t=>t.id)] as FilterType[]

function MD({children}:{children:string}){
  return <div className="pm-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>
}

const SAMPLE_TITLES = ["Pineapple on pizza — final verdict?","My corner store started putting fruit on everything","Best way to keep crust crispy with wet toppings?","Debate night: sweet vs savory"]
const SAMPLE_BODIES = [
 "I tried the pineapple + ham combo with a little chili flake. Sweet, salty, tiny heat. Not for everyone, but I get the appeal now.",
 "My take: if you like it, you like it. I'm team classic, but I won't argue with someone enjoying fruit + cheese.",
 "Pro tip: pat the topping dry first. Way less soggy crust.",
 "We did a blind taste test. Half liked it, half didn't. No fight, just preferences."
]
const SAMPLE_REPLIES = ["Same, I was skeptical but the sweet-salty thing works","Texture is what gets me, I keep it classic","Good tip on drying it first"]

function badgeFor(type:string){
  const found = POST_TYPES.find(t=>t.id===type)
  if (!found) return { badge: type.toUpperCase(), fg:'#444', bg:'#eee' }
  return { badge: found.badge, fg: found.fg, bg: found.bg }
}

export default function App(){
  // Unified server posts — one list, one DB, filtered by `type`
  const [posts, setPosts] = useState<UnifiedPost[]>([])
  const [total, setTotal] = useState<number|null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const filterRef = useRef<FilterType>('all')
  const offRef = useRef(0)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  // Collapse — all posts collapsed to title-only by default
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggleCollapse = (id:string)=> setCollapsed(s=>({...s, [id]: !(s[id] ?? true)}))

  const [threads, setThreads] = useState<Thread[]>(()=>{
    try{ return JSON.parse(localStorage.getItem('pm_threads')||'[]')}catch{return []}
  })
  const [title,setTitle]=useState(""); const [body,setBody]=useState("")
  const [likes, setLikes] = useState<Record<string,number>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [cmtTxt, setCmtTxt] = useState<Record<string,string>>({})

  const isServerFilter = (SERVER_FILTERS as string[]).includes(filter as string)
  const activeServerType = filter === 'all' ? null : filter as string

  const loadPosts = useCallback(async (reset=false)=>{
    if (!isServerFilter) return
    if (loadingRef.current) return
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    const off = reset ? 0 : offRef.current
    try {
      const typeParam = activeServerType ? `&type=${encodeURIComponent(activeServerType)}` : ''
      const r = await fetch(`/api/posts?offset=${off}&limit=${PAGE_SIZE}${typeParam}`)
      if (!r.ok) throw new Error('fetch failed')
      const data = await r.json()
      let page: UnifiedPost[] = data.posts || data
      const more = data.hasMore ?? false
      const tot = typeof data.total === 'number' ? data.total : null
      const nextOff = typeof data.nextOffset === 'number' ? data.nextOffset : off + page.length

      if (reset) {
        setPosts(page)
      } else {
        setPosts(prev=>{
          const seen = new Set(prev.map(p=>p.id))
          const fresh = page.filter(p=>!seen.has(p.id))
          return [...prev, ...fresh]
        })
      }
      offRef.current = nextOff
      hasMoreRef.current = more
      setHasMore(more)
      if (tot!==null) setTotal(tot)
    } catch {
      if (reset) {
        // fallback to static manifests merged (for local dev without KV)
        try {
          let merged: UnifiedPost[]=[]
          if (!activeServerType || activeServerType==='satire') {
            const rs = await fetch('/satire/manifest.json')
            if (rs.ok) {
              const arr = await rs.json()
              merged = merged.concat(arr.map((p:any)=>({...p, type:'satire'})))
            }
          }
          if (!activeServerType || activeServerType==='thesis') {
            const rt = await fetch('/thesis/manifest.json')
            if (rt.ok) {
              const arr = await rt.json()
              merged = merged.concat(arr.map((p:any)=>({...p, type:'thesis'})))
            }
          }
          merged.sort((a,b)=>b.ts-a.ts)
          const slice = merged.slice(off, off+PAGE_SIZE)
          if (reset) setPosts(slice)
          else setPosts(prev=>[...prev, ...slice])
          offRef.current = off+slice.length
          hasMoreRef.current = merged.length > off+slice.length
          setHasMore(merged.length > off+slice.length)
          setTotal(merged.length)
        } catch {}
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [isServerFilter, activeServerType])

  // initial + when filter changes — reset to first 5
  useEffect(()=>{
    filterRef.current = filter
    if (!isServerFilter) return
    offRef.current = 0
    hasMoreRef.current = true
    setHasMore(true)
    setTotal(null)
    setPosts([])
    loadPosts(true)
  }, [filter])

  // infinite scroll for unified list — 5 at a time, user never sees >5 viewport worth at once
  useEffect(()=>{
    const el = loaderRef.current
    if (!el) return
    if (!isServerFilter) return
    let t:any=null
    const obs = new IntersectionObserver((entries)=>{
      const e = entries[0]
      if (!e.isIntersecting) return
      if (loadingRef.current) return
      if (!hasMoreRef.current) return
      if (t) return
      t = setTimeout(()=>{
        t=null
        loadPosts(false)
      }, 250)
    }, { rootMargin:'200px', threshold:0 })
    obs.observe(el)
    return ()=>{ obs.disconnect(); if(t) clearTimeout(t) }
  }, [filter, loadPosts, isServerFilter])

  useEffect(()=>{ localStorage.setItem('pm_threads', JSON.stringify(threads)) },[threads])
  useEffect(()=>{
    if(threads.length===0){
      const now=Date.now()
      setThreads([
        {id:"t1",title:SAMPLE_TITLES[0],body:SAMPLE_BODIES[0],anon:"anon#0421",ts:now-1000000,replies:[
          {id:"r1",anon:"anon#8832",body:SAMPLE_REPLIES[0],ts:now-900000}
        ]},
        {id:"t2",title:SAMPLE_TITLES[1],body:SAMPLE_BODIES[1],anon:"anon#5519",ts:now-800000,replies:[]}
      ])
    }
  },[])

  // likes/comments hydration — generic by post id (works for any type)
  useEffect(()=>{
    posts.forEach(async p=>{
      try{ const lr=await fetch(`/api/likes?postId=${p.id}`); if(lr.ok){ const d=await lr.json(); setLikes(s=>({...s,[p.id]:d.likes})) } }catch{}
      try{ const cr=await fetch(`/api/comments?postId=${p.id}`); if(cr.ok){ const d=await cr.json(); setComments(s=>({...s,[p.id]:d.comments})) } }catch{}
    })
  },[posts])

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
    try{ const r=await fetch(`/api/likes?postId=${id}`,{method:'POST'}); if(r.ok){ const d=await r.json(); setLikes(s=>({...s,[id]:d.likes})) } }catch{}
  }
  async function postComment(id:string){
    const txt=(cmtTxt[id]||"").trim(); if(!txt) return
    const tmp:Comment={id:Math.random().toString(36).slice(2),anon:`anon#${Math.floor(1000+Math.random()*9000)}`,body:txt.slice(0,600),ts:Date.now()}
    setComments(s=>({...s,[id]:[tmp,...(s[id]||[])]}))
    setCmtTxt(s=>({...s,[id]:""}))
    try{
      const r=await fetch(`/api/comments?postId=${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:txt})})
      if(r.ok){ const rr=await fetch(`/api/comments?postId=${id}`); if(rr.ok){ const d=await rr.json(); setComments(s=>({...s,[id]:d.comments})) } }
      else setComments(s=>({...s,[id]:(s[id]||[]).filter(c=>c.id!==tmp.id)}))
    }catch{ setComments(s=>({...s,[id]:(s[id]||[]).filter(c=>c.id!==tmp.id)})) }
  }

  return (
    <div style={{maxWidth:960,margin:"0 auto",padding:"1rem"}}>
      <style>{`
        .pm-md :is(p, ul, ol, blockquote){margin:0.6rem 0; line-height:1.6}
        .pm-md h1,.pm-md h2,.pm-md h3,.pm-md h4{margin:0.9rem 0 0.4rem; line-height:1.25; font-weight:700}
        .pm-md h1{font-size:1.55rem} .pm-md h2{font-size:1.3rem; border-bottom:1px solid #eee; padding-bottom:6px} .pm-md h3{font-size:1.12rem} .pm-md h4{font-size:1.02rem; color:#444}
        .pm-md ul{padding-left:1.4rem} .pm-md ol{padding-left:1.4rem}
        .pm-md blockquote{border-left:4px solid #a8c0ff; padding:10px 14px; color:#333; font-style:italic; background:#f7f9ff; border-radius:6px; margin:12px 0}
        .pm-md code{background:#f0f2f7; padding:2px 6px; border-radius:4px; font-size:0.92em; border:1px solid #e6e8ee}
        .pm-md pre{background:#0f172a; color:#e2e8f0; padding:14px; border-radius:10px; overflow:auto; border:1px solid #1e293b}
        .pm-md pre code{background:transparent; padding:0; border:none; color:inherit}
        .pm-md a{color:#0b5fff; text-decoration:underline}
        .pm-md hr{border:none; border-top:2px solid #eef; margin:18px 0}
        .pm-md table{border-collapse:collapse; width:100%; margin:12px 0; font-size:0.92em}
        .pm-md th,.pm-md td{border:1px solid #dde; padding:8px 10px; text-align:left}
        .pm-md th{background:#f5f7ff; font-weight:700}
        .pm-md img{max-width:100%; border-radius:8px}
        .pm-tab{padding:6px 12px; border-radius:999px; border:1px solid #ddd; background:white; cursor:pointer; font-size:13px}
        .pm-tab.active{background:#111; color:white; border-color:#111}
        .pm-thesis-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin:10px 0}
      `}</style>
      <div style={{background:"#fff3cd",padding:"12px",borderRadius:8,marginBottom:16,fontWeight:600}}>⚠️ {DISCLAIMER}</div>
      <h1 style={{margin:"0.2rem 0"}}>post_more</h1>
      <p style={{color:"#666",marginTop:0}}>one list • filterable • {total!==null ? `${total} posts in DB • ` : ''}collapsible title-only • 5 first load • same DB with <code>type</code></p>

      <div style={{display:"flex", gap:8, margin:"14px 0", flexWrap:"wrap"}}>
        {/* All tab + dynamic type tabs + threads */}
        <button className={`pm-tab ${filter==='all'?'active':''}`} onClick={()=>setFilter('all')}>All ({total ?? '…'})</button>
        {POST_TYPES.map(t=>(
          <button key={t.id} className={`pm-tab ${filter===t.id?'active':''}`} onClick={()=>setFilter(t.id as any)}>{t.label}</button>
        ))}
        <button className={`pm-tab ${filter==='threads'?'active':''}`} onClick={()=>setFilter('threads')}>Threads</button>
      </div>

      {isServerFilter && (
        <div style={{margin:"18px 0"}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8}}>
            <h2 style={{fontSize:18, margin:0}}>{filter==='all'?'📦 All Posts — unified feed': filter==='thesis'?'📚 Thesis — PhD deep dives': filter==='satire'?'😏 Satire — parody': `📄 ${filter}`}</h2>
            <button onClick={()=>{ offRef.current=0; hasMoreRef.current=true; setHasMore(true); setPosts([]); loadPosts(true) }} style={{fontSize:12, padding:"4px 10px", borderRadius:6, border:"1px solid #ddd", background:"white"}}>↻ Refresh</button>
          </div>
          <div style={{fontSize:12, color:"#888", margin:"6px 0 10px"}}>{posts.length}{total!==null?` / ${total}`:''} loaded • newest first • 5 per scroll • collapsed by default</div>

          {posts.length===0 && loading && <div style={{padding:20, textAlign:"center", color:"#666"}}>Loading…</div>}

          {posts.map(p=>{
            const isCollapsed = collapsed[p.id] ?? true
            const {badge, fg, bg} = badgeFor(p.type)
            const isThesis = p.type==='thesis'
            return (
              <div key={p.id} style={{background:"white",padding: isCollapsed?"12px 14px":"16px",borderRadius:12,margin:"10px 0",border:"1px solid #e6e9f2",boxShadow:"0 2px 10px rgba(0,0,0,0.03)"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:11,color:"#6b7280",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:4}}>
                      <span style={{background:bg, color:fg, padding:"2px 7px", borderRadius:999, fontWeight:700, fontSize:10}}>{badge} • {p.type}</span>
                      <span style={{fontSize:11}}>{p.anon} — {new Date(p.ts).toLocaleDateString()}</span>
                    </div>
                    <h2 style={{margin:"4px 0 0", lineHeight:1.25, fontSize: isCollapsed?"15px":"18px", cursor:"pointer"}} onClick={()=>toggleCollapse(p.id)}>{p.title}</h2>
                  </div>
                  <button onClick={()=>toggleCollapse(p.id)} style={{flexShrink:0, padding:"4px 9px", borderRadius:6, border:"1px solid #ddd", background: isCollapsed?"#111":"white", color: isCollapsed?"white":"#111", fontSize:12, cursor:"pointer"}}>
                    {isCollapsed ? "▶ Show" : "▼ Hide"}
                  </button>
                </div>

                {!isCollapsed && (
                  <>
                    {isThesis && p.abstract && <div style={{background:"#f8fafc", border:"1px solid #eef2f7", padding:"10px 12px", borderRadius:8, marginTop:10, marginBottom:10, color:"#334155", fontSize:13}}><b>Abstract —</b> {p.abstract}</div>}

                    {(p as any).images && (p as any).images.length>0 ? (
                      <div className="pm-thesis-grid">{(p as any).images.slice(0,4).map((img:string,i:number)=>(<img key={i} src={img} style={{width:"100%", borderRadius:8, border:"1px solid #eef"}} alt={`${p.type} img ${i+1}`}/>))}</div>
                    ) : (p as any).image ? <img src={(p as any).image} style={{maxWidth:"100%",borderRadius:8,margin:"10px 0"}} alt={`${p.type} illustration`}/> : null}

                    <MD>{p.body}</MD>

                    {isThesis && (p as any).sources && (p as any).sources.length>0 && (
                      <div style={{marginTop:12, paddingTop:10, borderTop:"1px dashed #dde", fontSize:12, color:"#475569"}}>
                        <b>References</b>
                        <ul style={{margin:"6px 0 0", paddingLeft:18}}>{(p as any).sources.map((s:any,i:number)=>(<li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>{s.authors?` — ${s.authors}`:''}{s.year?` (${s.year})`:''}</li>))}</ul>
                      </div>
                    )}

                    <div style={{display:"flex",gap:12,alignItems:"center",marginTop:12}}>
                      <button onClick={()=>likePost(p.id)} style={{padding:"5px 12px", borderRadius:6, border:"1px solid #ddd", background:"white"}}>❤️ Like {likes[p.id]?`(${likes[p.id]})`:''}</button>
                      <span style={{fontSize:12,color:"#666"}}>{comments[p.id]?.length||0} comments</span>
                    </div>
                    <div style={{marginTop:8,display:"flex",gap:6}}>
                      <input value={cmtTxt[p.id]||""} onChange={e=>setCmtTxt(s=>({...s,[p.id]:e.target.value}))} placeholder={`Discuss this ${p.type} (markdown OK)`} style={{flex:1,padding:8, borderRadius:6, border:"1px solid #ddd"}}/>
                      <button onClick={()=>postComment(p.id)} style={{padding:"6px 12px", borderRadius:6}}>Post</button>
                    </div>
                    <div style={{marginLeft:8,borderLeft:"2px solid #eef2ff",paddingLeft:10,marginTop:8}}>
                      {(comments[p.id]||[]).map(c=><div key={c.id} style={{margin:"8px 0"}}><b>{c.anon}</b> <span style={{color:"#777",fontSize:11}}>{new Date(c.ts).toLocaleString()}</span><div style={{marginTop:2}}><MD>{c.body}</MD></div></div>)}
                    </div>
                  </>
                )}
              </div>
            )
          })}

          <div ref={loaderRef} style={{padding:"18px 0", textAlign:"center"}}>
            {loading ? <span style={{color:"#666", fontSize:13}}>Loading more…</span> : hasMore ? <span style={{color:"#999", fontSize:12}}>Scroll to load more • {posts.length} / {total ?? '...'}</span> : <span style={{color:"#888", fontSize:12}}>— End ({total ?? posts.length}) —</span>}
          </div>
        </div>
      )}

      {filter==='threads' && (
        <>
          <form onSubmit={addThread} style={{background:"white",padding:12,borderRadius:8,margin:"16px 0"}}>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thread title (keep it kind)" style={{width:"100%",padding:8,marginBottom:8}}/>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="What’s your take? Markdown supported — **bold**, *italic*, lists, >quote, code" style={{width:"100%",padding:8,minHeight:70}}/>
            <button type="submit" style={{marginTop:8,padding:"6px 12px"}}>Post thread (anon)</button>
          </form>
          <div>{threads.map(t=>(
            <div key={t.id} style={{background:"white",padding:12,borderRadius:8,margin:"12px 0"}}>
              <div style={{fontSize:13,color:"#777"}}>{t.anon} — {new Date(t.ts).toLocaleString()}</div>
              <h3 style={{margin:"6px 0"}}>{t.title}</h3>
              <MD>{t.body}</MD>
              <div style={{marginLeft:16,borderLeft:"2px solid #eee",paddingLeft:12}}>
                {t.replies.map(r=>(<div key={r.id} style={{margin:"8px 0"}}><span style={{fontWeight:600}}>{r.anon}</span> <span style={{color:"#777",fontSize:12}}>{new Date(r.ts).toLocaleString()}</span><div style={{marginTop:2}}><MD>{r.body}</MD></div></div>))}
                <ReplyBox onSend={txt=>addReply(t.id,txt)}/>
              </div>
            </div>
          ))}</div>
        </>
      )}

      <footer style={{marginTop:32,color:"#888",fontSize:12}}>One DB <code>post:index</code> + <code>post:post:&lt;id&gt;</code> with <code>type</code> field. Add new type by adding entry to POST_TYPES in <code>src/App.tsx</code> and saving posts with that type to same KV. Infinite scroll 5/page, collapsible title-only default.</footer>
    </div>
  )
}

function ReplyBox({onSend}:{onSend:(s:string)=>void}){
  const [txt,setTxt]=useState("")
  return <form onSubmit={e=>{e.preventDefault(); onSend(txt); setTxt("")}} style={{display:"flex",gap:6,marginTop:8}}>
    <input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Reply anonymously… markdown OK" style={{flex:1,padding:6}}/>
    <button>Reply</button>
  </form>
}
