'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errText } from './format';

// Siyahılar üçün ortaq "Daha çox yüklə" məntiqi (admin cədvəlləri).
//   fetchPage(from, to) -> Promise<{ data, error, count }>   (count yalnız ilk səhifədə lazımdır)
//   key: filtr dəyişəndə dəyişən sətir — siyahı yenidən yüklənir; köhnə sorğunun gec gələn cavabı nəzərə alınmır.
export function usePaged(fetchPage, size, key, enabled = true) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const req = useRef(0);
  const fetchRef = useRef(fetchPage);
  useEffect(() => { fetchRef.current = fetchPage; });

  useEffect(() => {
    if (!enabled) return undefined;
    const mine = ++req.current;
    setLoading(true);
    setError('');
    Promise.resolve(fetchRef.current(0, size - 1)).then(({ data, error: err, count }) => {
      if (mine !== req.current) return;
      if (err) { setError(errText(err, 'Siyahı yüklənmədi. Səhifəni yeniləyin.')); setRows([]); setTotal(0); } else {
        setRows(data || []);
        setTotal(count ?? (data || []).length);
      }
      setLoading(false);
    }).catch(() => { if (mine === req.current) { setError('Siyahı yüklənmədi. Səhifəni yeniləyin.'); setLoading(false); } });
    return () => { req.current += 1; };
  }, [key, tick, enabled, size]);

  const more = useCallback(async () => {
    const mine = req.current;
    setMoreLoading(true);
    const { data, error: err } = await fetchRef.current(rows.length, rows.length + size - 1);
    if (mine !== req.current) return;
    setMoreLoading(false);
    if (err) { setError(errText(err, 'Daha çox yüklənmədi.')); return; }
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...(data || []).filter((r) => !seen.has(r.id))];
    });
  }, [rows.length, size]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { rows, total, loading, moreLoading, error, more, reload, hasMore: !loading && rows.length < total };
}
