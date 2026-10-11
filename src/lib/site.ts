import metadata from '../data/site.json';
import { database, hasDatabase } from './db';
import { repository } from './repository';
import { summary, type Article } from './content';
export const site=metadata.site;
export const authors=metadata.authors;
export const tags=metadata.tags;
export const pages=metadata.pages as Article[];
export const origin='https://sparks.codezela.com';
export async function latestArticles(limit=4) {if(hasDatabase())return repository(await database()).latest(limit);return (await listArticles({limit})).articles;}
export async function listArticles(options:{page?:number;limit?:number;search?:string;tag?:string;author?:string}={}) {
  if(hasDatabase()) return repository(await database()).list(options);
  if(!import.meta.env.DEV && process.env.CONTENT_SOURCE !== 'snapshot') throw new Error('Configure DATABASE_URL for the public site.');
  const {page=1,limit=12,search='',tag='',author=''}=options;
  const {default:snapshot}=await import('../data/ghost-snapshot.json');
  const all=(snapshot.posts as Article[]).filter(p=>new Date(p.publishedAt)<=new Date()&&(!tag||p.tags.includes(tag))&&(!author||p.authors.includes(author))&&(!search||`${p.title} ${p.plaintext}`.toLowerCase().includes(search.toLowerCase())));
  return {articles:all.slice((page-1)*limit,page*limit).map(summary),total:all.length};
}
export async function getPage(slug:string) {if(hasDatabase())return repository(await database()).get(slug);return pages.find(p=>p.slug===slug);}
export async function getArticle(slug:string) {
  if(hasDatabase()) return repository(await database()).get(slug);
  if(!import.meta.env.DEV && process.env.CONTENT_SOURCE !== 'snapshot') throw new Error('Configure DATABASE_URL for the public site.');
  const {default:snapshot}=await import('../data/ghost-snapshot.json');
  return (snapshot.posts as Article[]).find(p=>p.slug===slug&&new Date(p.publishedAt)<=new Date());
}
export async function articleUrls() {
  if(hasDatabase()) return repository(await database()).urls();
  if(!import.meta.env.DEV && process.env.CONTENT_SOURCE !== 'snapshot') throw new Error('Configure DATABASE_URL for the public site.');
  const {default:snapshot}=await import('../data/ghost-snapshot.json');
  return snapshot.posts.map(({slug,publishedAt,updatedAt,canonicalUrl})=>({slug,publishedAt,updatedAt,canonicalUrl}));
}

export async function pageUrls(){if(hasDatabase())return repository(await database()).pageUrls();return pages.map(p=>({slug:p.slug,updatedAt:p.updatedAt}));}
