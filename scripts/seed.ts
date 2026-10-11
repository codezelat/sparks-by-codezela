import {neon} from '@neondatabase/serverless';
import snapshot from '../src/data/ghost-snapshot.json';
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL in .env before importing into Neon.');
const sql=neon(process.env.DATABASE_URL);
let imported=0;
const entries=[...snapshot.posts,...snapshot.pages];
for(let i=0;i<entries.length;i+=25) {
  const batch=entries.slice(i,i+25);
  const rows=await sql.transaction(batch.map(article=>sql`INSERT INTO articles(id,slug,published,published_at,updated_at,kind) VALUES(${article.id},${article.slug},${JSON.stringify(article)}::jsonb,${article.publishedAt},${article.updatedAt},${article.kind}) ON CONFLICT DO NOTHING RETURNING id`));
  imported+=rows.reduce((n,rows)=>n+rows.length,0);
}
const count=await sql`SELECT count(*)::integer AS total FROM articles WHERE published IS NOT NULL`;
console.log(`Imported ${imported} original content entries. ${count[0].total} published content entries in Neon. Existing edits were preserved.`);
