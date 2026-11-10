'use client';
import { useEffect, useRef, useState } from 'react';
import { loadProfiles } from '../../lib/forum';

// Siyahıdakı istifadəçi ID-lərinə görə ad və hesab tipi nişanlarını yükləyir (yalnız hələ yüklənməyənləri).
// Nəticə: { [id]: { id, full_name, account_type } }. Məlumat yalnız bazadakı profildən gəlir.
export function useProfileMap(ids) {
  const [map, setMap] = useState({});
  const asked = useRef(new Set());
  const key = [...new Set((ids || []).filter(Boolean))].sort().join(',');

  useEffect(() => {
    const need = key ? key.split(',').filter((i) => !asked.current.has(i)) : [];
    if (!need.length) return;
    need.forEach((i) => asked.current.add(i));
    loadProfiles(need).then((m) => setMap((prev) => ({ ...prev, ...m })));
  }, [key]);

  return map;
}
