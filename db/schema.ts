import { boolean, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
export const articles = pgTable('articles', {
  id: serial().primaryKey(), title: text().notNull(), description: text().notNull().default(''), source: text().notNull().default('Unknown'), publishedAt: timestamp('published_at', { withTimezone: true }).notNull(), url: text().notNull().unique(), category: text().notNull().default('Business'), content: text().notNull().default(''), summary: text(), takeaways: jsonb().$type<string[]>(), terms: jsonb().$type<{term:string;explanation:string}[]>(), whyItMatters: text('why_it_matters'), saved: boolean().notNull().default(false), createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
})
