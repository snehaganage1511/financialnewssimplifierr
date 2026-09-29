# FinBrief AI architecture

The TanStack Start frontend is in `src/`; the dashboard route is `src/routes/index.tsx` and its visual system is `src/styles.css`. It calls `/api/*` via `VITE_API_BASE_URL`, with an empty value using same-origin Netlify Functions.

The production API is `netlify/functions/api.mts`. Durable data uses Netlify Database and Drizzle, with schema in `db/schema.ts` and migrations in `netlify/database/migrations/`. Every schema change requires a migration. `backend/` is the portable FastAPI/SQLite alternative for a separate Python host.

Keep keys server-side. Preserve loading, error, empty, dark, and responsive states. API response fields use frontend-friendly camelCase.
