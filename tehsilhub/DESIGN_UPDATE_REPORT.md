# TəhsilHub — Dizayn yenilənməsi hesabatı (v4.0)

## 1. Nəticə
Bütün mövcud səhifələr vahid **mavi-ağ dizayn sisteminə** keçirildi. Arxitektura, Supabase sorğuları, RPC-lər, RLS, fayl yükləmə yoxlamaları, sürət limitləri və server tərəfli sınaq yoxlaması **dəyişdirilməyib**. Yeni asılılıq əlavə olunmayıb (ikonlar layihənin öz SVG dəstidir; yalnız `eslint` inkişaf asılılığı kimi əlavə edilib).

## 2. Dizayn sistemi
**Tokenlər** (`app/globals.css`, RGB kanalları; `tailwind.config.js` onları `primary`, `canvas`, `surface`, `ink`, `muted`, `line`, `success`, `danger`, `warning` adları ilə bağlayır, `bg-primary/10` kimi şəffaflıq dəstəklənir):

| Token | Dəyər | İstifadə |
|---|---|---|
| primary / hover / soft | `#2563EB` / `#1D4ED8` / `#EFF6FF` | düymələr, linklər, aktiv vəziyyət, açıq fon |
| canvas / surface | `#F8FAFC` / `#FFFFFF` | səhifə fonu / kartlar |
| ink / muted / line | `#0F172A` / `#64748B` / `#E2E8F0` | əsas mətn / ikinci mətn / sərhəd |
| success / danger / warning | `#16A34A` / `#DC2626` / `#D97706` | düzgün-səhv, xəbərdarlıq |

**Qaydalar:** vahid şrift ailəsi (Inter → sistem şrifti, xarici şrift yüklənmir); kartlar `rounded-xl` + incə sərhəd + yumşaq kölgə; düymə hündürlüyü 36/40/44 px; input hündürlüyü 40 px, focus halqası; gradient yalnız yoxdur, animasiya yalnız keçid/skeleton (`prefers-reduced-motion` nəzərə alınır).

**Ortaq komponentlər:** `components/ui.js` (`PageHeader`, `EmptyState`, `Alert`, `Spinner`, `CardGridSkeleton`, `Modal`), `components/Icons.js` (26 ikon), `components/Shell.js` (header, mobil menyu, profil menyusu, footer), `components/HomeLive.js` (ana səhifənin canlı bölmələri). CSS sinifləri: `.btn*`, `.card`, `.input`, `.label`, `.badge`, `.alert-*`, `.skeleton`.

## 3. Səhifələr
- **Header/naviqasiya:** loqo, 5 bölmə, aktiv vəziyyət, giriş etməyibsə “Daxil ol/Qeydiyyat”, girişdən sonra profil menyusu (Kabinet, Mesajlar, Çıxış) və oxunmamış mesaj nişanı (mövcud `unread_message_count` RPC-si ilə). Mobildə hamburger menyu (əvvəlki alt panel əvəz olundu), “əsas məzmuna keç” keçidi.
- **Ana səhifə:** tələb olunan başlıq, 2 CTA, 4 xidmət kartı; **son sınaqlar / son elanlar / yeni PDF-lər real bazadan** göstərilir (məlumat yoxdursa bölmə gizlənir, hamısı boşdursa boş vəziyyət); girişsiz istifadəçilər üçün CTA; AdSense yeri; tam footer.
- **Giriş/qeydiyyat/şifrə bərpası:** tab keçidi, parolu göstər/gizlət, yüklənmə düyməsi, rəngli xəta/uğur bildirişləri, `/auth?mode=register`.
- **Kitab elanları və PDF arxivi:** axtarış + mobildə açılıb-bağlanan filtrlər, skeleton yüklənmə, “filtrləri təmizlə” ilə boş vəziyyət, favori (`aria-pressed`), mobil şəkil sahəsi aspekt qutusu ilə (layout sıçraması yoxdur).
- **Sınaqlar:** kateqoriya tabları, sınaq kartları, taymer, irəliləyiş çubuğu (`progressbar`), cavabın dərhal göstərilməsi, nəticə halqası, yenidən başla.
- **Çat:** göndərilən/qəbul edilən balonlar, boş vəziyyətlər, mobildə siyahı ↔ söhbət keçidi, xəta bildirişi (limit mesajları daxil).
- **Kabinet:** profil başlığı, tablar (elanlar, PDF-lər, favorilər, **sınaq nəticələri tarixçəsi**, profil), hesabı silmə **modalı** (təsdiq sözü ilə).
- **Hüquqi səhifələr, 404, 500, boş/yüklənmə vəziyyətləri:** vahid dizayn.

## 4. Davranış baxımından əlavələr (yalnız mövcud məlumat/RPC-lərdən istifadə edir)
Sınaq nəticələri tarixçəsi (mövcud `quiz_attempts` oxunur), oxunmamış mesaj nişanı (mövcud RPC), `window.prompt` əvəzinə hesab silmə modalı, `/auth?mode=register`. Bunlardan başqa heç bir yeni biznes funksiyası yaradılmayıb.

## 5. Dizayn sınağı zamanı tapılıb düzəldilən real xətalar
1. **Modal fokus oğurluğu:** hər düymə basılanda fokus pəncərəyə qayıdırdı, “SİL” yazmaq mümkün deyildi → düzəldildi (fokus yalnız açılanda verilir, bağlananda əvvəlki elementə qayıdır).
2. **Bildiriş rəngləri:** `alert-${type}` dinamik sinifləri Tailwind tərəfindən yaradılmırdı, xəta/uğur bildirişləri rəngsiz idi → tam sinif adları xəritəsi.
3. **Çat scroll-u:** mesaj göndərəndə bütün səhifə aşağı (footer-ə) sürüşürdü → yalnız mesaj konteyneri scroll olunur.
4. **Rəng kontrastı (WCAG AA):** açıq mavi fonda ikinci mətn və mavi balonda yarı-şəffaf vaxt yazısı → düzəldildi.

## 6. Edilməyənlər və səbəbləri
- **Qlobal axtarış** header-də yoxdur: layihədə qlobal axtarış səhifəsi yoxdur. Axtarış/filtr kitab və PDF səhifələrindədir.
- **Ətraflı elan səhifəsi, admin paneli, profil şəkli, rəy/reytinq** layihədə mövcud deyil; vizual yenilənmə bəhanəsi ilə yaradılmayıb. Bunlar Axtar.xyz-in köhnə layihəsinə aiddir və ayrıca qiymətləndirilməlidir.
- **`next/image`:** elan şəkilləri dinamik Supabase ünvanlarından gəlir; optimallaşdırıcı konfiqurasiyası (domen siyahısı) və Vercel kvotasından asılılıq yaranmasın deyə aspekt qutulu `<img loading="lazy" decoding="async">` saxlanıb.
- **Tooltip/toast:** tətbiq edilməyib (inline bildirişlər istifadə olunur), çünki mövcud axınlarda ehtiyac yoxdur.

## 7. Dəyişdirilmiş və yeni fayllar
**Yeni:** `components/ui.js`, `components/Icons.js`, `components/HomeLive.js`, `eslint.config.mjs`, `DESIGN_UPDATE_REPORT.md`, `TEST_REPORT.md`, `screenshots/*`, `tests/browser/*`.
**Dəyişdirilib:** `app/globals.css`, `tailwind.config.js`, `app/layout.js`, `app/page.js`, `app/icon.js`, `app/not-found.js`, `app/error.js`, `app/auth/page.js`, `app/auth/reset/page.js`, `app/books/page.js`, `app/pdfs/page.js`, `app/quizzes/page.js`, `app/chat/page.js`, `app/profile/page.js`, `components/Shell.js`, `components/AdSlot.js`, `components/AuthProvider.js`, `components/LegalView.js`, `package.json`, `package-lock.json`, `README.md`, `DEPLOY.md`.
**Toxunulmayıb:** `lib/*`, `next.config.js`, bütün SQL faylları, `app/robots.js`, `app/sitemap.js`, `app/ads.txt/route.js`, route layout-ları (SEO metadata).
