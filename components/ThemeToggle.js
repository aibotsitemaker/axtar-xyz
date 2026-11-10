'use client';

import { useEffect, useState } from 'react';
import Icon from './Icons';

const KEY = 'tehsilhub-theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let selected = false;
    try { selected = localStorage.getItem(KEY) === 'dark'; } catch { /* Yaddaş bağlıdırsa açıq rejimdən başla. */ }
    setDark(selected);
    document.documentElement.dataset.theme = selected ? 'dark' : 'light';
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem(KEY, next ? 'dark' : 'light'); } catch { /* Rejim bu səhifədə tətbiq olunur. */ }
  }

  return <button type="button" onClick={toggle} className="icon-button" aria-label={dark ? 'Açıq rejimə keç' : 'Qaranlıq rejimə keç'} title={dark ? 'Açıq rejim' : 'Qaranlıq rejim'}><Icon name={dark ? 'sun' : 'moon'} className="h-5 w-5" /></button>;
}
