'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { PageHeader, Spinner } from '../../components/ui';

const FILTERS=[['all','Hamısı'],['teachers','Müəllimlər'],['verified','Doğrulanmış'],['profiles','İstifadəçilər'],['books','Elanlar'],['pdfs','PDF'],['forum','Forum'],['feed','Feed']];
const LABEL={profile:'İstifadəçi',forum_reply:'Forum cavabı',book:'Elan',pdf:'PDF',forum:'Forum mövzusu',feed:'Feed'};
export default function SearchPage(){
 const [query,setQuery]=useState(''); const [kind,setKind]=useState('all'); const [rows,setRows]=useState([]); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{setQuery(new URLSearchParams(window.location.search).get('q')||'');},[]);
 useEffect(()=>{let active=true;const q=query.trim();if(q.length<2){setRows([]);setError('');setLoading(false);return undefined;}setLoading(true);setError('');const timer=setTimeout(async()=>{const {data,error:e}=await supabase.rpc('global_search',{p_query:q,p_kind:kind});if(!active)return;setRows(data||[]);setError(e?.message||'');setLoading(false);},250);return()=>{active=false;clearTimeout(timer);};},[query,kind]);
 return <div className="mx-auto max-w-3xl"><PageHeader title="Axtarış" subtitle="Müəllimləri, resursları, forumu və Feed paylaşımlarını axtarın."/><label htmlFor="global-q" className="sr-only">Axtarış sözü</label><input id="global-q" className="input w-full" value={query} onChange={e=>setQuery(e.target.value.slice(0,100))} placeholder="Ad, fənn və ya açar söz…" autoFocus/>
 <div className="my-4 flex gap-2 overflow-x-auto pb-2">{FILTERS.map(([id,label])=><button key={id} className={`btn btn-sm shrink-0 ${kind===id?'btn-primary':'btn-secondary'}`} onClick={()=>setKind(id)}>{label}</button>)}</div>
 {query.trim().length<2?<div className="card p-8 text-center text-sm text-muted">Axtarış üçün ən azı 2 simvol daxil edin.</div>:loading?<div className="card flex justify-center p-10"><Spinner/></div>:error?<div className="card p-6 text-sm text-danger">Axtarış alınmadı: {error}</div>:rows.length===0?<div className="card p-8 text-center text-sm text-muted">Uyğun nəticə tapılmadı.</div>:<div className="space-y-3" aria-live="polite">{rows.map((r,i)=><Link key={`${r.kind}-${r.id}-${i}`} href={r.href} className="card block p-4 hover:border-primary"><span className="badge badge-muted">{LABEL[r.kind]||r.kind}</span><h2 className="mt-2 font-semibold">{r.title}</h2><p className="mt-1 line-clamp-2 text-sm text-muted">{r.excerpt}</p></Link>)}</div>}
 </div>;
}
