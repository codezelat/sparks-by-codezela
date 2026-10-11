import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

export const imageUrl = z.string().max(2000).refine(value => !value || /^\/media\/[a-zA-Z0-9_./-]+$/.test(value) || /^https:\/\//.test(value), 'Use a local media path or HTTPS URL');
export const articleInput = z.object({
  kind: z.enum(['post','page']).default('post'),
  title: z.string().trim().min(1).max(300),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200).refine(value=>!['studio','auth','api','search','page','tag','author','rss','robots','sitemap','404'].includes(value),'This URL is reserved'),
  html: z.string().max(500000),
  excerpt: z.string().max(2000).default(''),
  featureImage: imageUrl.nullable().default(null),
  featureImageAlt: z.string().max(500).default(''),
  featureImageCaption: z.string().max(2000).default(''),
  metaTitle: z.string().max(300).default(''),
  metaDescription: z.string().max(2000).default(''),
  canonicalUrl: z.string().max(2000).refine(v => !v || /^https:\/\//.test(v)).default(''),
  ogTitle: z.string().max(300).default(''),
  ogDescription: z.string().max(2000).default(''),
  ogImage: imageUrl.nullable().default(null),
  twitterTitle: z.string().max(300).default(''),
  twitterDescription: z.string().max(2000).default(''),
  twitterImage: imageUrl.nullable().default(null),
  authors: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(10).default(['codezela-cc']),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).default([]),
  publishedAt: z.iso.datetime({ offset: true }),
}).refine(input=>input.slug!=='about'||input.kind==='page',{message:'About is a page URL',path:['slug']});
export type ArticleInput = z.infer<typeof articleInput>;
export type Article = ArticleInput & {
  id: string; plaintext: string; updatedAt: string; readingMinutes: number;
  image?: {src: string; srcset: string; width: number; height: number} | null;
};
export type ArticleSummary = Omit<Article, 'html' | 'plaintext'>;
export type StudioArticle = {id: string; slug: string; title: string; status: 'draft'|'published'; version:number; publishedAt:string|null; updatedAt:string; hasDraft:boolean};
export const PAGE_SIZE = 12;
export function safeHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags,'img','figure','figcaption','h1','h2','h3','h4','h5','h6','s','u'],
    allowedAttributes: {a:['href','title','rel'],img:['src','alt','width','height','loading'], '*':['id'], th:['colspan','rowspan'],td:['colspan','rowspan']},
    allowedSchemes:['https','http','mailto','tel'], allowProtocolRelative:false,
    transformTags:{a:(tag,attrs)=>({tagName:tag,attribs:{...attrs,rel:'noopener noreferrer'}}), img:(tag,attrs)=>({tagName:tag,attribs:{...attrs,loading:'lazy'}})},
  });
}
export function plaintext(html:string) { return sanitizeHtml(html.replace(/<\/(?:p|h[1-6]|li|div|blockquote)>|<br\s*\/?>/gi,' '),{allowedTags:[],allowedAttributes:{}}).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); }
export function prepareArticle(input: ArticleInput, id: string): Article {
  const html=safeHtml(input.html); const text=plaintext(html);
  return {...input,id,html,plaintext:text,updatedAt:new Date().toISOString(),readingMinutes:Math.max(1,Math.ceil(text.split(/\s+/).length/230))};
}
export function dateLabel(date:string) {return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Colombo'}).format(new Date(date));}
export function summary(article:Article):ArticleSummary { const {html,plaintext,...rest}=article; return rest; }
export function xmlEscape(value:string) {return value.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}
