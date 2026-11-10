// Yalnız https:// ünvanlarına icazə verir (javascript:, data: və s. bloklanır).
export function safeUrl(u) {
  if (typeof u !== 'string') return '';
  try {
    const p = new URL(u);
    return p.protocol === 'https:' ? p.href : '';
  } catch (e) {
    return '';
  }
}

// Fayl yükləmədən əvvəl format və ölçü yoxlaması. Boş sətir = uyğundur.
export function validateFile(file, types, maxMb) {
  if (!types.includes(file.type)) return 'Yanlış fayl formatı.';
  if (file.size > maxMb * 1024 * 1024) return `Fayl ${maxMb} MB-dan böyük ola bilməz.`;
  return '';
}
