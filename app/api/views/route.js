import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COOKIE='th_view_session';
const limits=globalThis.__thViewLimits||(globalThis.__thViewLimits=new Map());
function signature(id,secret){return createHmac('sha256',secret).update(id).digest('hex');}
function parseCookie(value,secret){if(!value)return null;const [id,sig]=value.split('.');if(!id||!sig||!/^[0-9a-f-]{36}$/i.test(id))return null;const want=signature(id,secret);try{return timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(want,'hex'))?id:null;}catch{return null;}}
export async function POST(request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,secret=process.env.VIEW_SESSION_SECRET;
 if(!url||!key||!secret||secret.length<32)return NextResponse.json({error:'Baxış sayğacı server konfiqurasiyası tamamlanmayıb.'},{status:503});
 const ua=request.headers.get('user-agent')||'';if(!ua||/(bot|crawler|spider|headless|curl|wget)/i.test(ua))return NextResponse.json({ok:false},{status:200});
 const ip=request.headers.get('x-real-ip')||(request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();const now=Date.now();const entry=limits.get(ip)||{start:now,count:0};if(now-entry.start>60000){entry.start=now;entry.count=0;}entry.count+=1;limits.set(ip,entry);if(entry.count>120)return NextResponse.json({error:'Sorğu limiti aşıldı.'},{status:429});if(limits.size>5000)for(const [k,v] of limits)if(now-v.start>120000)limits.delete(k);
 let input;try{input=await request.json();}catch{return NextResponse.json({error:'Sorğu formatı yanlışdır.'},{status:400});}
 const allowed=['pdf','book','forum_topic','profile','feed_post'];if(!allowed.includes(input?.contentType)||typeof input?.contentId!=='string'||input.contentId.length>100)return NextResponse.json({error:'Məzmun identifikatoru yanlışdır.'},{status:400});
 let id=parseCookie(request.cookies.get(COOKIE)?.value,secret);const response=NextResponse.json({ok:true});if(!id){id=randomUUID();response.cookies.set(COOKIE,`${id}.${signature(id,secret)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*365});}
 const ipHash=createHmac('sha256',secret).update('ip:'+ip).digest('hex');const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await db.rpc('record_content_view',{p_type:input.contentType,p_id:input.contentId,p_guest_key:id,p_ip_hash:ipHash});if(error)return NextResponse.json({error:'Baxışı qeydə almaq mümkün olmadı.'},{status:500});return NextResponse.json({ok:Boolean(data)} ,{headers:response.headers});
}
