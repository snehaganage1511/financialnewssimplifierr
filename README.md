# FinBrief AI

FinBrief AI turns current financial reporting into concise, beginner-friendly briefs. It combines NewsAPI stories with grounded Groq Llama 3.3 70B summaries, takeaways, decoded terms, bookmarks, search, sharing, and light/dark themes.

## Technology

TanStack Start, React, TypeScript, Netlify Functions, Netlify Database with Drizzle, NewsAPI, Groq, plus an optional FastAPI/SQLite backend.

## Local setup

1. Copy `.env.example` to `.env` and add `NEWS_API_KEY` and `GROQ_API_KEY`.
2. Run `pnpm install`.
3. Run `netlify dev --port 8889` and open `http://localhost:8889`.

Without keys, the UI provides a curated fallback and reports provider availability. Keys never reach browser JavaScript.

## Deployment

Connect the repository to Netlify. The included configuration builds the app, deploys Functions, and applies database migrations. Add both provider keys as secret environment variables. Keep `VITE_API_BASE_URL` empty for same-origin APIs.

For the requested Python deployment, install `backend/requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port 8000` from `backend/`, and use a host with persistent disk storage. Set `SQLITE_PATH`, `CORS_ORIGINS`, and the frontend `VITE_API_BASE_URL` to the service URL.

The REST API includes news, search, summarization, saved-article CRUD, and health endpoints. AI briefs are educational and informational only, not financial advice.
