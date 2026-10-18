'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

const MAP = { privacy: 'privacy_policy', terms: 'terms_of_service' };

function inline(text) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
  );
}

function Markdown({ source }) {
  const out = [];
  let list = [];
  const flush = (k) => {
    if (list.length) {
      out.push(<ul key={`ul-${k}`} className="my-3 list-disc space-y-1 pl-6 text-slate-600">{list.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>);
      list = [];
    }
  };
  source.split('\n').forEach((raw, idx) => {
    const line = raw.trim();
    if (line.startsWith('- ')) { list.push(line.slice(2)); return; }
    flush(idx);
    if (!line) return;
    if (line.startsWith('## ')) out.push(<h2 key={idx} className="mb-2 mt-8 text-lg font-semibold">{line.slice(3)}</h2>);
    else if (line.startsWith('# ')) out.push(<h1 key={idx} className="mb-4 text-3xl font-bold tracking-tight">{line.slice(2)}</h1>);
    else out.push(<p key={idx} className="my-2 leading-relaxed text-slate-600">{inline(line)}</p>);
  });
  flush('end');
  return <>{out}</>;
}

export default function LegalPage() {
  const { type } = useParams();
  const [doc, setDoc] = useState(null);
  const [state, setState] = useState('loading');
  const docType = MAP[type];

  useEffect(() => {
    if (!docType) { setState('missing'); return; }
    supabase.from('privacy_policy_terms').select('*').eq('doc_type', docType).eq('is_active', true)
      .order('effective_date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setDoc(data); setState(data ? 'ok' : 'missing'); });
  }, [docType]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6 md:p-10">
        {state === 'loading' && <p className="text-slate-400">Yüklənir...</p>}
        {state === 'missing' && <p className="text-slate-500">Sənəd tapılmadı.</p>}
        {state === 'ok' && (
          <>
            <Markdown source={doc.content} />
            <p className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">Versiya {doc.version} · Qüvvəyə minmə: {doc.effective_date}</p>
          </>
        )}
      </div>
      <div className="mt-4 flex justify-center gap-5 text-sm text-slate-500">
        <Link href="/legal/privacy" className="hover:text-ink">Məxfilik Siyasəti</Link>
        <Link href="/legal/terms" className="hover:text-ink">İstifadə Şərtləri</Link>
      </div>
    </div>
  );
}
