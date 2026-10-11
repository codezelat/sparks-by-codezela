import type {APIRoute} from 'astro';
import {articleUrls,pageUrls,origin,tags,authors} from '../lib/site';
import {xmlEscape} from '../lib/content';
export const GET:APIRoute=async()=>{
  const [articles,pages]=await Promise.all([articleUrls(),pageUrls()]);
  const urls=[{loc:`${origin}/`},...pages.map(p=>({loc:`${origin}/${p.slug}/`,lastmod:p.updatedAt})),...tags.map(t=>({loc:`${origin}/tag/${t.slug}/`})),...authors.map(a=>({loc:`${origin}/author/${a.slug}/`})),...articles.filter(p=>!p.canonicalUrl||p.canonicalUrl===`${origin}/${p.slug}/`).map(p=>({loc:`${origin}/${p.slug}/`,lastmod:p.updatedAt})),...Array.from({length:Math.ceil(articles.length/12)},(_,i)=>({loc:`${origin}/page/${i+1}/`}))];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${xmlEscape(u.loc)}</loc>${'lastmod'in u?`<lastmod>${xmlEscape(u.lastmod as string)}</lastmod>`:''}</url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
