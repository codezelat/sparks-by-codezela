import type {APIRoute} from 'astro';
import {database} from '../../../lib/db';
import {repository,ConflictError} from '../../../lib/repository';
import {validMutation} from '../../../lib/auth';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
export const GET:APIRoute=async({url})=>{try{return json(await repository(await database()).revisions(url.searchParams.get('id')||''));}catch{return json({error:'History could not be loaded.'},503);}};
export const POST:APIRoute=async({request,locals})=>{
 if(!validMutation(request))return json({error:'Invalid request origin'},403);
 try{const {id,version,action,revisionId}=await request.json();if(!/^[-a-zA-Z0-9]{1,80}$/.test(id||'')||!Number.isInteger(version)||version<1)return json({error:'Invalid request'},400);
 const repo=repository(await database());
 if(action==='unpublish')return json(await repo.unpublish(id,version,locals.session!.id));
 if(action==='restore'&&/^\d{1,20}$/.test(revisionId||''))return json(await repo.restore(id,revisionId,version,locals.session!.id));
 return json({error:'Invalid action'},400);
 }catch(error){return json({error:error instanceof ConflictError?error.message:'This action could not be completed.'},error instanceof ConflictError?409:503);}
};
