'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

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
      out.push(<ul key={`ul-${k}`} className="my-3 list-disc space-y-1.5 pl-6 text-ink/80">{list.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>);
      list = [];
    }
  };
  source.split('\n').forEach((raw, idx) => {
    const line = raw.trim();
    if (line.startsWith('- ')) { list.push(line.slice(2)); return; }
    flush(idx);
    if (!line) return;
    if (line.startsWith('## ')) out.push(<h2 key={idx} className="mb-2 mt-9 text-xl font-semibold">{line.slice(3)}</h2>);
    else if (line.startsWith('# ')) out.push(<h1 key={idx} className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">{line.slice(2)}</h1>);
    else out.push(<p key={idx} className="my-2 leading-relaxed text-ink/80">{inline(line)}</p>);
  });
  flush('end');
  return <>{out}</>;
}

export default function LegalView({ type }) {
  const [doc, setDoc] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    supabase.from('privacy_policy_terms').select('*').eq('doc_type', MAP[type]).eq('is_active', true)
      .order('effective_date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setDoc(data); setState(data ? 'ok' : 'missing'); });
  }, [type]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6 sm:p-10">
        {state === 'loading' && <div className="space-y-3" aria-busy="true"><div className="skeleton h-9 w-2/3" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-5/6" /><div className="skeleton h-4 w-4/6" /></div>}
        {state === 'missing' && <p className="text-muted">Sənəd tapılmadı.</p>}
        {state === 'ok' && (
          <>
            <Markdown source={doc.content} />
            <p className="mt-9 border-t border-line pt-4 text-xs text-muted">Versiya {doc.version} · Qüvvəyə minmə: {doc.effective_date}</p>
          </>
        )}
      </div>
      <div className="mt-5 flex justify-center gap-6 text-sm text-muted">
        <Link href="/legal/privacy" className="hover:text-primary">Məxfilik Siyasəti</Link>
        <Link href="/legal/terms" className="hover:text-primary">İstifadə Şərtləri</Link>
      </div>
    </div>
  );
}
