import { supabase } from './supabase';

export const PAGE_SIZE = 15;
export const REPLY_PAGE = 100;

export const REPORT_REASONS = [
  ['spam', 'Spam və ya reklam'],
  ['abuse', 'Təhqir və ya təhdid'],
  ['offtopic', 'Mövzudan kənar'],
  ['unsafe', 'Təhlükəli və ya uyğun olmayan məzmun'],
  ['other', 'Digər']
];
export const REASON_LABEL = Object.fromEntries(REPORT_REASONS);

export const STATUS_LABEL = { active: 'Aktiv', hidden: 'Gizli', deleted: 'Silinib' };

export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

// Axtarış sözündən filtr sintaksisini pozan simvolları çıxarır (PostgREST or() və ilike üçün təhlükəsiz).
export function searchTerm(raw) {
  return String(raw || '').replace(/[%_\\",()*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

// Profil siyahısı: { id: { full_name, account_type } }. Rozet yalnız bazadakı profil məlumatından gəlir.
export async function loadProfiles(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (!uniq.length) return {};
  const { data, error } = await supabase.from('profiles').select('id, full_name, account_type').in('id', uniq);
  if (error || !data) return {};
  const map = {};
  data.forEach((p) => { map[p.id] = p; });
  return map;
}

export async function loadCategories() {
  const { data } = await supabase.from('forum_categories').select('id, slug, name, description, sort_order, is_active')
    .order('sort_order', { ascending: true }).order('name', { ascending: true });
  return data || [];
}

export const TOPIC_COLS = 'id, title, excerpt, category_id, author_id, status, is_pinned, is_locked, reply_count, last_reply_at, last_reply_author_id, last_activity_at, created_at';
