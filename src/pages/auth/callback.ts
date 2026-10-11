import type {APIRoute} from 'astro';
import {allowedAdmin,appOrigin,authConfigured,cookieName,cookieOptions,env,signToken,verifyToken} from '../../lib/auth';
export const GET:APIRoute=async({url,cookies,redirect})=>{
  const state=verifyToken(cookies.get('sparks_oauth')?.value||'');cookies.delete('sparks_oauth',{path:'/'});
  if(!authConfigured()||!state||url.searchParams.get('state')!==state.id||!url.searchParams.get('code'))return redirect('/studio/login/?error=sign-in',303);
  try {
    const res=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env('GITHUB_CLIENT_ID'),client_secret:env('GITHUB_CLIENT_SECRET'),code:url.searchParams.get('code'),redirect_uri:`${appOrigin()}/auth/callback/`}),signal:AbortSignal.timeout(10000)});
    const token=await res.json();if(!res.ok||!token.access_token)throw new Error('Token exchange failed');
    const userResponse=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${token.access_token}`,Accept:'application/vnd.github+json','User-Agent':'Sparks-Studio'},signal:AbortSignal.timeout(10000)});
    const user=await userResponse.json();if(!userResponse.ok||!allowedAdmin(String(user.id)))return redirect('/studio/login/?error=access',303);
    cookies.set(cookieName(),signToken({id:String(user.id),name:user.name||user.login,expires:Date.now()+8*3600000}),{...cookieOptions(),maxAge:8*3600});
    return redirect('/studio/',303);
  }catch{return redirect('/studio/login/?error=sign-in',303);}
};
