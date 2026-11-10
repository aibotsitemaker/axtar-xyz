const OPTS_DATE = { day: '2-digit', month: '2-digit', year: 'numeric' };
const OPTS_DATETIME = { ...OPTS_DATE, hour: '2-digit', minute: '2-digit' };

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('az-AZ', OPTS_DATE) : '');
export const fmtDateTime = (d) => (!d ? '' : d === 'infinity' ? 'qeyri-müəyyən müddət' : new Date(d).toLocaleString('az-AZ', OPTS_DATETIME));

// Bloklanma müddəti mətni: "05.11.2026 12:00-dək" və ya "qeyri-müəyyən müddətə" (bazada 'infinity').
export const fmtBlockUntil = (d) => (d === 'infinity' ? 'qeyri-müəyyən müddətə' : `${fmtDateTime(d)}-dək`);

// "5 dəq. əvvəl" tipli nisbi vaxt. Bir həftədən köhnə tarixlər adi tarix kimi göstərilir.
export function timeAgo(d) {
  if (!d) return '';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (sec < 60) return 'indicə';
  if (sec < 3600) return `${Math.floor(sec / 60)} dəq. əvvəl`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} saat əvvəl`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)} gün əvvəl`;
  return fmtDate(d);
}

// Baza xətasını istifadəçi üçün qısa mətnə çevirir. Texniki xətalar (icazə, şəbəkə) ümumi mesajla əvəz olunur;
// serverin özünün yazdığı aydın Azərbaycan dilli xətalar (limit, validasiya, bloklanma) olduğu kimi göstərilir.
export function errText(error, fallback = 'Əməliyyat alınmadı. Bir az sonra yenidən cəhd edin.') {
  const m = String((error && error.message) || '').trim();
  if (!m) return fallback;
  if (/permission denied|row-level security|violates|JWT|fetch|network|schema cache|could not find the function|PGRST|syntax/i.test(m)) return fallback;
  return m.length > 300 ? fallback : m;
}
