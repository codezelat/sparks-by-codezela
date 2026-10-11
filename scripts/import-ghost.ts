import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import overrides from '../src/data/media-overrides.json';
const mediaOverrides=overrides as Record<string,{source:string;reason:string}>;

const origin = 'https://sparks.codezela.com';
const homepage = await fetch(origin).then(r => r.text());
const key = homepage.match(/data-key="([a-f0-9]+)"/)?.[1];
if (!key) throw new Error('Public Ghost Content API key not found');
const api = 'https://sparks-by-codezela.ghost.io/ghost/api/content';
async function read(name: string) {
  let entries: any[] = []; let page = 1;
  do {
    const res = await fetch(`${api}/${name}/?key=${key}&limit=100&page=${page}&include=tags,authors&formats=html,plaintext`);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    const data = await res.json();
    if (name === 'settings') return data.settings;
    entries.push(...data[name]); page = data.meta?.pagination?.next;
  } while (page);
  return entries;
}
const [posts, pages, tags, authors, settings] = await Promise.all(['posts','pages','tags','authors','settings'].map(read));
const $ = cheerio.load(await fetch(`${origin}/sitemap-posts.xml`).then(r => r.text()), { xml: true });
const sourceUrls = $('url > loc').map((_, el) => $(el).text()).get();
const missing = sourceUrls.filter(url => !posts.some((p:any) => p.url === url));
if (missing.length) throw new Error(`Missing ${missing.length} sitemap URLs`);
await mkdir('public/media', { recursive: true });
await mkdir('src/data', { recursive: true });
const allMedia = new Set<string>();
for (const p of [...posts,...pages]) {const body=cheerio.load(p.html||'');body('img').each((_,el)=>{const url=body(el).attr('src');if(url&&url.startsWith('https://'))allMedia.add(url);});}
for (const p of [...posts,...pages]) for(const url of [p.feature_image,p.og_image,p.twitter_image]) if (url) allMedia.add(url);
for (const k of ['logo','icon','og_image','twitter_image']) if (settings[k]) allMedia.add(settings[k]);
for (const a of authors) if (a.profile_image) allMedia.add(a.profile_image);
for(const item of Object.values(mediaOverrides)) allMedia.add(item.source);
const map: Record<string, any> = {};
const missingMedia:string[]=[];
const queue = [...allMedia]; let complete = 0;
await Promise.all(Array.from({length: 8}, async () => {
  while (queue.length) {
    const url = queue.shift()!;
    const id = createHash('sha256').update(url).digest('hex').slice(0,16);
    const paths = [480,960,1600].map(w => `public/media/${id}-${w}.webp`);
    if (!(await Bun.file(paths[2]).exists())) {
      let buffer: Buffer | undefined;
      for (let attempt=0; attempt<3; attempt++) {
        try { const r=await fetch(url,{signal:AbortSignal.timeout(30000)}); if(!r.ok) throw new Error(`${r.status}`); buffer=Buffer.from(await r.arrayBuffer()); break; }
        catch(e) { if(attempt===2) { missingMedia.push(url); console.warn(`Source media unavailable: ${url}`); } }
      }
      if(!buffer) continue;
      await Promise.all([480,960,1600].map((width,i) => sharp(buffer).rotate().resize({width,withoutEnlargement:true}).webp({quality:85}).toFile(paths[i])));
    }
    const meta=await sharp(paths[2]).metadata();
    map[url] = { src: `/media/${id}-1600.webp`, srcset: [480,960,1600].filter(w => w <= (meta.width ?? 1600)).map(w => `/media/${id}-${w}.webp ${w}w`).join(', '), width:meta.width,height:meta.height };
    complete++; if (complete%50===0) console.log(`Copied ${complete}/${allMedia.size} media assets`);
  }
}));
function normalize(p:any) {
  const cover=mediaOverrides[p.slug]?.source || p.feature_image;
  return {
    kind:p.kind||'post',id:p.id,slug:p.slug,title:p.title,html:p.html.replace(/(<img[^>]+src=["'])(https:\/\/[^"']+)(["'])/g,(_:string,before:string,url:string,after:string)=>`${before}${map[url]?.src||url}${after}`),plaintext:p.plaintext,
    excerpt:p.custom_excerpt || p.excerpt || '',
    featureImage:cover?map[cover]?.src || null:null,
    featureImageAlt:p.feature_image_alt || p.title,
    featureImageCaption:p.feature_image_caption || '',
    image:cover?map[cover] || null:null,
    publishedAt:new Date(p.published_at).toISOString(),updatedAt:new Date(p.updated_at).toISOString(),
    metaTitle:p.meta_title || '',metaDescription:p.meta_description || '',
    canonicalUrl:p.canonical_url || '',
    ogTitle:p.og_title || '',ogDescription:p.og_description || '',ogImage:p.og_image?map[p.og_image]?.src || null:null,
    twitterTitle:p.twitter_title || '',twitterDescription:p.twitter_description || '',twitterImage:p.twitter_image?map[p.twitter_image]?.src || null:null,
    authors:p.authors?.map((a:any)=>a.slug) || ['codezela-cc'],tags:p.tags?.map((t:any)=>t.slug) || [],
    readingMinutes:Math.max(1,Math.ceil(p.plaintext.split(/\s+/).length/230))
  };
}
// Collect social overrides too, so future Ghost cancellation cannot break sharing images.
const social = [...posts,...pages].flatMap(p=>[p.og_image,p.twitter_image]).filter(Boolean);
if(social.some(url=>!map[url]&&!missingMedia.includes(url))) throw new Error('Uncopied social image: add to media inventory');
const site = {name:settings.title,slogan:settings.description,title:settings.meta_title,description:settings.meta_description,logo:map[settings.logo]?.src,icon:map[settings.icon]?.src,ogImage:map[settings.og_image]?.src,twitterImage:map[settings.twitter_image]?.src,navigation:settings.navigation,secondaryNavigation:settings.secondary_navigation,facebook:settings.facebook,twitter:settings.twitter,analyticsId:'G-1FHLXFGZRV'};
const snapshot={posts:posts.map(normalize),pages:pages.map((p:any)=>normalize({...p,kind:'page'})),authors:authors.map((a:any)=>({...a,profile_image:a.profile_image?map[a.profile_image]?.src:null})),tags,site};
await writeFile('src/data/ghost-snapshot.json',JSON.stringify(snapshot));
await writeFile('src/data/site.json',JSON.stringify({site:snapshot.site,pages:snapshot.pages,authors:snapshot.authors,tags:snapshot.tags}));
await writeFile('src/data/media-manifest.json',JSON.stringify(map,null,2));
await writeFile('docs/migration-inventory.json',JSON.stringify({importedAt:new Date().toISOString(),source:origin,posts:posts.length,pages:pages.length,authors:authors.length,tags:tags.length,media:Object.keys(map).length,missingMedia,mediaReplacements:mediaOverrides,unresolvedMedia:missingMedia.filter(url=>!posts.some((p:any)=>p.feature_image===url&&mediaOverrides[p.slug])),articlesWithMissingMedia:posts.filter((p:any)=>missingMedia.includes(p.feature_image)).map((p:any)=>({slug:p.slug,sourceImage:p.feature_image})),sourceSitemapPosts:sourceUrls.length,missingSitemapUrls:missing,canonicalOverrides:posts.filter((p:any)=>p.canonical_url).map((p:any)=>({slug:p.slug,canonical:p.canonical_url})),urls:[...posts,...pages].map(p=>new URL(p.url).pathname),sourceSitemapUrls:sourceUrls},null,2));
console.log(`Imported ${posts.length} posts, ${pages.length} pages and ${allMedia.size} media assets. No sitemap URLs missing.`);
