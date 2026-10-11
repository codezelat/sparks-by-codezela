import type {APIRoute} from 'astro';
import {put} from '@vercel/blob';
import sharp from 'sharp';
import {writeFile,mkdir} from 'node:fs/promises';
import {env,validMutation} from '../../../lib/auth';
import {localStudio} from '../../../lib/db';
export const POST:APIRoute=async({request})=>{
  const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  if(!validMutation(request))return json({error:'Invalid request origin'},403);
  if(Number(request.headers.get('content-length'))>4200000)return json({error:'Choose an image under 4 MB'},413);
  try {
    const form=await request.formData();const file=form.get('file');
    if(!(file instanceof File)||file.size>4000000||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))return json({error:'Choose a JPEG, PNG, WebP or AVIF image under 4 MB'},400);
    const bytes=Buffer.from(await file.arrayBuffer());
    const buffer=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize({width:1800,withoutEnlargement:true}).webp({quality:85}).toBuffer();
    const filename=`media/${crypto.randomUUID()}.webp`;
    if(localStudio()){await mkdir('public/media',{recursive:true});await writeFile(`public/${filename}`,buffer);return json({url:`/${filename}`});}
    if(!env('BLOB_READ_WRITE_TOKEN'))return json({error:'Image storage has not been connected'},503);
    const blob=await put(filename,buffer,{access:'public',contentType:'image/webp',token:env('BLOB_READ_WRITE_TOKEN')});
    return json({url:blob.url});
  }catch{return json({error:'Image upload failed. Please try again.'},400);}
};
