import {scrypt,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
const options={N:131072,r:8,p:1,maxmem:256*1024*1024};
function derive(password:string,salt:string,length:number,settings:typeof options):Promise<Buffer> {return new Promise((resolve,reject)=>scrypt(password,salt,length,settings,(error,key)=>error?reject(error):resolve(key)));}
export async function hashPassword(password:string) {
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,64,options) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password:string,hash:string) {
  const [algorithm,salt,key]=hash.split('$');
  if(algorithm!=='scrypt'||!salt||!key||password.length>256)return false;
  try{const actual=await derive(password,salt,64,options) as Buffer;const expected=Buffer.from(key,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected);}catch{return false;}
}
export function limitKey(address:string) {return createHash('sha256').update(`studio-signin:${address}`).digest('hex');}
