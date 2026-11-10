'use client';
import { useEffect, useState } from 'react';
import BooksPanel from '../../../components/admin/content/BooksPanel';
import PdfsPanel from '../../../components/admin/content/PdfsPanel';
import QuizzesPanel from '../../../components/admin/content/QuizzesPanel';
import { Alert, ListSkeleton, PageHeader } from '../../../components/ui';

const TABS = [['books', 'Kitab elanları'], ['pdfs', 'PDF resursları'], ['quizzes', 'Sınaqlar']];
const KEYS = TABS.map((t) => t[0]);

// Platformanın məzmunu: elanlar, PDF-lər və sınaqlar. Reklam sahələri hazırda mühit dəyişənləri ilə (NEXT_PUBLIC_ADSENSE_*) idarə olunur,
// bazada admin tərəfindən dəyişdirilən sayt parametri yoxdur — buna görə bu səhifədə yoxdur.
export default function AdminContentPage() {
  const [tab, setTab] = useState(null);
  const [flash, setFlash] = useState({ type: '', text: '' });

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    setTab(KEYS.includes(t) ? t : 'books');
  }, []);

  function pick(k) {
    setTab(k);
    setFlash({ type: '', text: '' });
    window.history.replaceState(null, '', `/admin/content?tab=${k}`);
  }

  const onFlash = (type, text) => setFlash({ type, text });

  return (
    <div>
      <PageHeader title="Məzmun" subtitle="Elanları, PDF resurslarını və sınaqları idarə edin. Hər dəyişiklik audit jurnalında qeyd olunur." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Məzmun növü">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => pick(k)} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
        ))}
      </div>
      {flash.text && <Alert type={flash.type === 'error' ? 'error' : 'success'} className="mb-4">{flash.text}</Alert>}
      {tab === null ? <ListSkeleton count={3} /> : (
        <>
          {tab === 'books' && <BooksPanel key="books" onFlash={onFlash} />}
          {tab === 'pdfs' && <PdfsPanel key="pdfs" onFlash={onFlash} />}
          {tab === 'quizzes' && <QuizzesPanel key="quizzes" onFlash={onFlash} />}
        </>
      )}
    </div>
  );
}
