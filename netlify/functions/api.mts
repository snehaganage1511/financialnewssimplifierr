import type { Config, Context } from '@netlify/functions'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { articles } from '../../db/schema.js'

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}})
const category=(text:string)=>{const s=text.toLowerCase();if(/bitcoin|crypto|ethereum/.test(s))return'Cryptocurrency';if(/bank|lender/.test(s))return'Banking';if(/tech|ai |chip|software/.test(s))return'Technology';if(/stock|shares|index/.test(s))return'Stock Market';if(/econom|inflation|jobs|rates/.test(s))return'Economy';if(/global|world|asia|europe/.test(s))return'Global Markets';return'Business'}
const normalize=(a:any)=>({title:a.title||'Untitled',description:a.description||'',source:a.source?.name||a.source||'Unknown',publishedAt:a.publishedAt||new Date().toISOString(),url:a.url,content:a.content||'',category:category(`${a.title} ${a.description}`)})
async function news(q='finance OR markets OR economy'){
 const key=process.env.NEWS_API_KEY;if(!key)return json({articles:[],configured:false})
 const u=new URL('https://newsapi.org/v2/everything');u.searchParams.set('q',q);u.searchParams.set('language','en');u.searchParams.set('sortBy','publishedAt');u.searchParams.set('pageSize','24')
 const r=await fetch(u,{headers:{'X-Api-Key':key}});if(!r.ok)return json({error:'News provider unavailable'},502);const body=await r.json();return json({articles:(body.articles||[]).filter((a:any)=>a.url&&a.title!=='[Removed]').map(normalize)})
}
async function summarize(req:Request){
 const a:any=await req.json();if(!a.title)return json({error:'Article title is required'},400)
 const cached=await db.select().from(articles).where(eq(articles.url,a.url)).limit(1).catch(()=>[]);if(cached[0]?.summary)return json({summary:cached[0].summary,takeaways:cached[0].takeaways,terms:cached[0].terms,whyItMatters:cached[0].whyItMatters})
 const key=process.env.GROQ_API_KEY;if(!key)return json({error:'AI summarization is not configured'},503)
 const prompt=`Summarize only the supplied article. Never invent facts, numbers, context, or advice. Return strict JSON with keys summary (simple English, 2-3 sentences), takeaways (3 concise strings), terms (array of up to 3 objects with term and beginner-friendly explanation), whyItMatters (2 sentences). ARTICLE TITLE: ${a.title}\nDESCRIPTION: ${a.description||''}\nCONTENT: ${a.content||''}`
 const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',temperature:.15,response_format:{type:'json_object'},messages:[{role:'system',content:'You are a careful financial-news editor. Use only provided facts and never give financial advice.'},{role:'user',content:prompt}]})});if(!r.ok)return json({error:'AI provider unavailable'},502)
 const body:any=await r.json();let result;try{result=JSON.parse(body.choices[0].message.content)}catch{return json({error:'Invalid AI response'},502)}
 await db.insert(articles).values({...normalize(a),publishedAt:new Date(a.publishedAt||Date.now()),summary:result.summary,takeaways:result.takeaways,terms:result.terms,whyItMatters:result.whyItMatters}).onConflictDoUpdate({target:articles.url,set:{summary:result.summary,takeaways:result.takeaways,terms:result.terms,whyItMatters:result.whyItMatters}}).catch(()=>null);return json(result)
}
async function saved(req:Request,id?:number){
 if(req.method==='GET')return json(await db.select().from(articles).where(eq(articles.saved,true)).orderBy(desc(articles.createdAt)))
 if(req.method==='POST'){const a:any=await req.json();if(!a.url)return json({error:'Article URL is required'},400);const [row]=await db.insert(articles).values({...normalize(a),publishedAt:new Date(a.publishedAt||Date.now()),saved:true}).onConflictDoUpdate({target:articles.url,set:{saved:true}}).returning();return json(row,201)}
 if(req.method==='DELETE'&&id){const [row]=await db.update(articles).set({saved:false}).where(and(eq(articles.id,id),eq(articles.saved,true))).returning();return row?json({ok:true}):json({error:'Not found'},404)}return json({error:'Method not allowed'},405)
}
export default async(req:Request,ctx:Context)=>{try{const u=new URL(req.url),path=u.pathname;if(path==='/api/health')return json({status:'healthy',services:{database:'configured',news:Boolean(process.env.NEWS_API_KEY),ai:Boolean(process.env.GROQ_API_KEY)}});if(path==='/api/news/search')return news(u.searchParams.get('q')||'finance');if(path==='/api/news')return news();if(path==='/api/summarize'&&req.method==='POST')return summarize(req);if(path==='/api/saved')return saved(req);if(path.startsWith('/api/saved/'))return saved(req,Number(ctx.params.id||path.split('/').pop()));return json({error:'Not found'},404)}catch(e){console.error(e instanceof Error?e.message:'API error');return json({error:'Something went wrong. Please try again.'},500)}}
export const config:Config={path:['/api/news','/api/news/search','/api/summarize','/api/saved','/api/saved/:id','/api/health']}
