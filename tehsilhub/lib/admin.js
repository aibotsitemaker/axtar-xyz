// Admin panelinin ortaq köməkçiləri. Real icazə HƏMİŞƏ bazada yoxlanılır (admin RPC-ləri və RLS);
// buradakı kod yalnız interfeysi qurur.
import { fmtDateTime } from './format';

export const PAGE = 25;

export const ACTION_LABELS = {
  'admin.bootstrap': 'Super Admin təyin edildi (SQL)',
  'admin.grant': 'Admin hüququ verildi',
  'admin.revoke': 'Admin hüququ ləğv edildi',
  'user.block': 'İstifadəçi bloklandı',
  'user.unblock': 'Blok götürüldü',
  'user.delete': 'Hesab silindi',
  'user.account_type.change': 'Hesab tipi dəyişdirildi',
  'user.note.add': 'İstifadəçi qeydi əlavə edildi',
  'forum.topic.hide': 'Mövzu gizlədildi',
  'forum.topic.restore': 'Mövzu bərpa edildi',
  'forum.topic.delete': 'Mövzu silindi',
  'forum.topic.pin': 'Mövzu sabitləndi',
  'forum.topic.unpin': 'Sabit götürüldü',
  'forum.topic.lock': 'Mövzu bağlandı',
  'forum.topic.unlock': 'Mövzu açıldı',
  'forum.topic.edit': 'Mövzu redaktə edildi',
  'forum.reply.hide': 'Cavab gizlədildi',
  'forum.reply.restore': 'Cavab bərpa edildi',
  'forum.reply.delete': 'Cavab silindi',
  'forum.reply.edit': 'Cavab redaktə edildi',
  'forum.report.resolved': 'Şikayət həll edildi',
  'forum.report.dismissed': 'Şikayət rədd edildi',
  'forum.report.open': 'Şikayət yenidən açıldı',
  'forum.category.create': 'Kateqoriya yaradıldı',
  'forum.category.update': 'Kateqoriya yeniləndi',
  'forum.category.activate': 'Kateqoriya aktivləşdirildi',
  'forum.category.deactivate': 'Kateqoriya deaktiv edildi',
  'quiz.create': 'Sınaq yaradıldı',
  'quiz.update': 'Sınaq yeniləndi',
  'quiz.delete': 'Sınaq silindi',
  'books.update': 'Elan dəyişdirildi',
  'books.delete': 'Elan silindi',
  'books.insert': 'Elan əlavə edildi',
  'pdfs.update': 'PDF dəyişdirildi',
  'pdfs.delete': 'PDF silindi',
  'pdfs.insert': 'PDF əlavə edildi'
};
export const actionLabel = (a) => ACTION_LABELS[a] || a;

export const AUDIT_GROUPS = [
  ['', 'Bütün əməliyyatlar'],
  ['user.%', 'İstifadəçilər'],
  ['admin.%', 'Admin hüquqları'],
  ['forum.%', 'Forum'],
  ['quiz.%', 'Sınaqlar'],
  ['books.%', 'Elanlar'],
  ['pdfs.%', 'PDF-lər']
];

const DETAIL_KEYS = {
  note: 'Qeyd', reason: 'Səbəb', until: 'Müddət', from: 'Əvvəl', to: 'Sonra', level: 'Səviyyə', old_name: 'Köhnə ad',
  changed: 'Dəyişən sahələr', status_from: 'Status (əvvəl)', status_to: 'Status (sonra)', questions: 'Sual sayı',
  attempts_deleted: 'Silinən nəticələr', title_changed: 'Başlıq dəyişdi', body_changed: 'Mətn dəyişdi', category_changed: 'Kateqoriya dəyişdi',
  published_from: 'Dərc (əvvəl)', published_to: 'Dərc (sonra)'
};

// Audit "details" obyektini qısa mətnə çevirir (server artıq sirləri təmizləyib; burada yalnız oxunaqlı format).
export function detailText(details) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'bəli' : 'xeyr') : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${DETAIL_KEYS[k] || k}: ${val.length > 120 ? `${val.slice(0, 120)}…` : val}`;
    })
    .join(' · ');
}

export const BLOCK_PRESETS = [
  ['1', '1 gün'],
  ['7', '7 gün'],
  ['30', '30 gün'],
  ['forever', 'Qeyri-müəyyən müddət']
];

// Preset → timestamptz (null = qeyri-müəyyən; server bunu 'infinity' kimi saxlayır)
export function blockUntil(preset) {
  if (preset === 'forever') return null;
  const days = Number(preset);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + days * 86400000).toISOString();
}

export const STATUS_BADGE = { active: 'Aktiv', hidden: 'Gizli', deleted: 'Silinib', sold: 'Satılıb' };

export const when = fmtDateTime;

// Forum moderasiya əməliyyatlarının izahı: [düymə adı, təsdiq mətni, təhlükəlidir?]
export const MOD_TEXT = {
  hide: ['Gizlət', 'Məzmun adi istifadəçilərə görünməyəcək. Sonra bərpa edə bilərsiniz.', true],
  delete: ['Sil', 'Məzmun silinmiş sayılır (yumşaq silinmə, tarixçə saxlanılır) və açıq şikayətlər həll olunur.', true],
  restore: ['Bərpa et', 'Məzmun yenidən hamıya görünəcək.', false],
  pin: ['Sabitlə', 'Mövzu siyahının başında görünəcək.', false],
  unpin: ['Sabiti götür', 'Mövzu adi sıraya qayıdacaq.', false],
  lock: ['Bağla', 'Yeni cavab yazmaq və redaktə mümkün olmayacaq.', false],
  unlock: ['Aç', 'Mövzu yenidən cavablara açılacaq.', false]
};

export const USER_TYPE_FILTERS = [
  ['', 'Bütün tiplər'],
  ['teacher', 'Müəllim'],
  ['student', 'Şagird'],
  ['university_student', 'Tələbə'],
  ['none', 'Tipi seçilməyib']
];
export const USER_STATE_FILTERS = [
  ['all', 'Bütün istifadəçilər'],
  ['admin', 'Adminlər'],
  ['blocked', 'Bloklanmışlar']
];

export const levelLabel = (l) => (l === 'super' ? 'Super Admin' : l === 'admin' ? 'Admin' : '');
export const searchLike = (raw) => String(raw || '').replace(/[%_\\",()*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
