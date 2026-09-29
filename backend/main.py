"""Portable FastAPI/SQLite implementation of the FinBrief API."""
import json, os
from contextlib import asynccontextmanager
import aiosqlite, httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
DB=os.getenv('SQLITE_PATH','finbrief.db')
SCHEMA='''CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT DEFAULT '',source TEXT DEFAULT 'Unknown',published_at TEXT NOT NULL,url TEXT NOT NULL UNIQUE,category TEXT DEFAULT 'Business',content TEXT DEFAULT '',summary TEXT,takeaways TEXT,terms TEXT,why_it_matters TEXT,saved INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP)'''
class Article(BaseModel):
 title:str;description:str='';source:str='Unknown';publishedAt:str;url:str;category:str='Business';content:str=''
@asynccontextmanager
async def lifespan(_:FastAPI):
 async with aiosqlite.connect(DB) as db: await db.execute(SCHEMA);await db.commit()
 yield
app=FastAPI(title='FinBrief AI API',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=os.getenv('CORS_ORIGINS','http://localhost:8889').split(','),allow_methods=['*'],allow_headers=['*'])
@app.get('/api/health')
async def health(): return {'status':'healthy','services':{'news':bool(os.getenv('NEWS_API_KEY')),'ai':bool(os.getenv('GROQ_API_KEY'))}}
@app.get('/api/news')
async def news(q:str='finance OR markets OR economy'):
 key=os.getenv('NEWS_API_KEY')
 if not key:return {'articles':[],'configured':False}
 async with httpx.AsyncClient(timeout=20) as client:r=await client.get('https://newsapi.org/v2/everything',params={'q':q,'language':'en','sortBy':'publishedAt','pageSize':24},headers={'X-Api-Key':key})
 if r.status_code!=200:raise HTTPException(502,'News provider unavailable')
 return {'articles':[{'title':a['title'],'description':a.get('description') or '','source':a.get('source',{}).get('name','Unknown'),'publishedAt':a['publishedAt'],'url':a['url'],'content':a.get('content') or '','category':'Business'} for a in r.json().get('articles',[]) if a.get('url')]}
@app.get('/api/news/search')
async def search(q:str):return await news(q)
@app.post('/api/summarize')
async def summarize(a:Article):
 key=os.getenv('GROQ_API_KEY')
 if not key:raise HTTPException(503,'AI summarization is not configured')
 prompt=f'Use only this article. Return strict JSON with summary, takeaways (3 strings), terms (term and explanation objects), whyItMatters. No invented facts or advice. TITLE: {a.title}\nDESCRIPTION: {a.description}\nCONTENT: {a.content}'
 async with httpx.AsyncClient(timeout=45) as client:r=await client.post('https://api.groq.com/openai/v1/chat/completions',headers={'Authorization':f'Bearer {key}'},json={'model':'llama-3.3-70b-versatile','temperature':.15,'response_format':{'type':'json_object'},'messages':[{'role':'system','content':'You are a careful financial-news editor.'},{'role':'user','content':prompt}]})
 if r.status_code!=200:raise HTTPException(502,'AI provider unavailable')
 result=json.loads(r.json()['choices'][0]['message']['content'])
 async with aiosqlite.connect(DB) as db:await db.execute('INSERT INTO articles(title,description,source,published_at,url,category,content,summary,takeaways,terms,why_it_matters) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET summary=excluded.summary,takeaways=excluded.takeaways,terms=excluded.terms,why_it_matters=excluded.why_it_matters',(a.title,a.description,a.source,a.publishedAt,a.url,a.category,a.content,result['summary'],json.dumps(result['takeaways']),json.dumps(result.get('terms',[])),result['whyItMatters']));await db.commit()
 return result
@app.get('/api/saved')
async def get_saved():
 async with aiosqlite.connect(DB) as db:db.row_factory=aiosqlite.Row;rows=await (await db.execute('SELECT id,title,description,source,published_at AS publishedAt,url,category,content FROM articles WHERE saved=1 ORDER BY created_at DESC')).fetchall()
 return [dict(r) for r in rows]
@app.post('/api/saved',status_code=201)
async def save(a:Article):
 async with aiosqlite.connect(DB) as db:await db.execute('INSERT INTO articles(title,description,source,published_at,url,category,content,saved) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(url) DO UPDATE SET saved=1',(a.title,a.description,a.source,a.publishedAt,a.url,a.category,a.content));await db.commit();row=await (await db.execute('SELECT id FROM articles WHERE url=?',(a.url,))).fetchone()
 return {'id':row[0],**a.model_dump(),'saved':True}
@app.delete('/api/saved/{article_id}')
async def unsave(article_id:int):
 async with aiosqlite.connect(DB) as db:cur=await db.execute('UPDATE articles SET saved=0 WHERE id=?',(article_id,));await db.commit()
 if not cur.rowcount:raise HTTPException(404,'Not found')
 return {'ok':True}
