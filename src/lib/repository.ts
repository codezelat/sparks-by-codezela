import type {Article, ArticleSummary, StudioArticle} from './content';
import type {Query} from './db';
export class ConflictError extends Error {}
const projection=`published - 'html' - 'plaintext'`;
export function repository(query:Query) {
  return {
    async latest(limit=4) {const rows=await query<{data:ArticleSummary}>(`SELECT ${projection} AS data FROM articles WHERE kind='post' AND published IS NOT NULL AND published_at<=now() ORDER BY published_at DESC,id LIMIT $1`,[limit]);return rows.map(row=>row.data);},
    async list({page=1,limit=12,search='',tag='',author=''}={}) {
      const params=[search,tag,author];
      const where=`kind='post' AND published IS NOT NULL AND published_at <= now() AND ($1 = '' OR search_vector @@ websearch_to_tsquery('english',$1) OR published->>'title' ILIKE '%' || $1 || '%') AND ($2 = '' OR published->'tags' ? $2) AND ($3 = '' OR published->'authors' ? $3)`;
      const [rows,count]=await Promise.all([query<{data:ArticleSummary}>(`SELECT ${projection} AS data FROM articles WHERE ${where} ORDER BY published_at DESC,id LIMIT $4 OFFSET $5`,[...params,limit,(page-1)*limit]),query<{total:string}>(`SELECT count(*) AS total FROM articles WHERE ${where}`,params)]);
      return {articles:rows.map(r=>r.data),total:Number(count[0].total)};
    },
    async get(slug:string) {const rows=await query<{data:Article}>('SELECT published AS data FROM articles WHERE slug=$1 AND published IS NOT NULL AND published_at <= now()',[slug]);return rows[0]?.data;},
    async urls() {return query<{slug:string;publishedAt:string;updatedAt:string;canonicalUrl:string}>(`SELECT slug,published->>'publishedAt' AS "publishedAt",published->>'updatedAt' AS "updatedAt",published->>'canonicalUrl' AS "canonicalUrl" FROM articles WHERE kind='post' AND published IS NOT NULL AND published_at <= now() ORDER BY published_at DESC`);},
    async studioList(page=1,search='',status='',kind='post') {
      const where=`kind=$4 AND ($1 = '' OR coalesce(draft->>'title',published->>'title') ILIKE '%' || $1 || '%') AND ($2 = '' OR ($2 = 'published' AND published IS NOT NULL) OR ($2 = 'draft' AND draft IS NOT NULL))`;
      const [rows,count]=await Promise.all([query<StudioArticle>(`SELECT id,slug,coalesce(draft->>'title',published->>'title') AS title,CASE WHEN published IS NULL THEN 'draft' ELSE 'published' END AS status,version,published_at AS "publishedAt",updated_at AS "updatedAt",draft IS NOT NULL AS "hasDraft" FROM articles WHERE ${where} ORDER BY updated_at DESC,id LIMIT 20 OFFSET $3`,[search,status,(page-1)*20,kind]),query<{total:string}>(`SELECT count(*) AS total FROM articles WHERE ${where} AND $3::integer>=0`,[search,status,0,kind])]);
      return {articles:rows,total:Number(count[0].total)};
    },
    async studioGet(id:string) {const rows=await query<{id:string;version:number;published:Article|null;draft:Article|null}>('SELECT id,version,published,draft FROM articles WHERE id=$1',[id]);return rows[0];},
    async revisions(id:string){return query<{id:string;action:string;createdAt:string;title:string}>(`SELECT id::text,action,created_at AS "createdAt",content->>'title' AS title FROM revisions WHERE article_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`,[id]);},
    async restore(id:string,revisionId:string,version:number,actor:string){const rows=await query<{content:Article}>('SELECT content FROM revisions WHERE article_id=$1 AND id=$2::bigint',[id,revisionId]);if(!rows[0])throw new ConflictError('Revision could not be found.');return this.save({...rows[0].content,updatedAt:new Date().toISOString()},version,'draft',actor);},
    async unpublish(id:string,version:number,actor:string){const rows=await query<{id:string;version:number}>(`WITH changed AS (UPDATE articles SET draft=coalesce(draft,published),published=NULL,published_at=NULL,version=version+1,updated_at=now() WHERE id=$1 AND version=$2 AND published IS NOT NULL RETURNING id,version,draft),revision AS (INSERT INTO revisions(article_id,content,action,actor) SELECT id,draft,'unpublish',$3 FROM changed RETURNING article_id) SELECT changed.id,changed.version FROM changed JOIN revision ON revision.article_id=changed.id`,[id,version,actor]);if(!rows[0])throw new ConflictError('This article changed. Reload before unpublishing.');return rows[0];},
    async pageUrls(){return query<{slug:string;updatedAt:string}>(`SELECT slug,published->>'updatedAt' AS "updatedAt" FROM articles WHERE kind='page' AND published IS NOT NULL AND published_at<=now()`);},
    async save(article:Article,version:number,action:'draft'|'publish',actor:string) {
      const serialized=JSON.stringify(article);
      const rows=await query<{id:string;version:number}>(`WITH changed AS (
        INSERT INTO articles(id,slug,published,draft,published_at,version,kind)
        SELECT $1,$2,CASE WHEN $4='publish' THEN $3::jsonb ELSE NULL END,CASE WHEN $4='draft' THEN $3::jsonb ELSE NULL END,CASE WHEN $4='publish' THEN ($3::jsonb->>'publishedAt')::timestamptz ELSE NULL END,1,$7 WHERE $5=0
        ON CONFLICT DO NOTHING RETURNING id,version
      ), updated AS (
        UPDATE articles SET slug=$2,published=CASE WHEN $4='publish' THEN $3::jsonb ELSE published END,draft=CASE WHEN $4='draft' THEN $3::jsonb ELSE NULL END,
        published_at=CASE WHEN $4='publish' THEN ($3::jsonb->>'publishedAt')::timestamptz ELSE published_at END,version=version+1,updated_at=now()
        WHERE id=$1 AND version=$5 AND $5>0 AND kind=$7 AND (published IS NULL OR slug=$2) RETURNING id,version
      ), saved AS (SELECT * FROM changed UNION ALL SELECT * FROM updated), revision AS (
        INSERT INTO revisions(article_id,content,action,actor) SELECT id,$3::jsonb,$4,$6 FROM saved RETURNING article_id
      ) SELECT saved.id,saved.version FROM saved JOIN revision ON revision.article_id=saved.id`,[article.id,article.slug,serialized,action,version,actor,article.kind]);
      if(!rows[0]) throw new ConflictError('This article changed in another tab, or its URL conflicts with an existing article. Reload before saving.');
      return rows[0];
    }
  };
}
