# Forum bələdçisi

## Necə işləyir
- **Giriş:** `/forum` hamıya açıqdır (qonaq oxuyur). Mövzu açmaq, cavab yazmaq, şikayət etmək üçün giriş lazımdır; qonaq "Daxil ol" səhifəsinə yönləndirilir və girişdən sonra geri qayıdır (`?next=`). Admin icazəsi tələb olunmur.
- **Mövzu:** başlıq (5–150), mətn (10–10 000), kateqoriya. Siyahıda axtarış, kateqoriya filtri, çeşidləmə (son aktiv / ən çox cavab / yeni) və "Daha çox yüklə" var. Sabitlənmiş mövzular başdadır.
- **Cavab:** 1–5000 simvol, bir səviyyə "cavaba cavab". Realtime ilə yeni cavablar gəlir.
- **Rozet:** adın yanında Müəllim / Şagird / Tələbə — yalnız bazadakı `profiles.account_type`-dan.
- **Redaktə/silmə:** müəllif öz mövzu və cavabını redaktə/silir. Silmə **yumşaqdır** (`status='deleted'`), tarixçə saxlanılır.
- **Şikayət:** hər məzmun üçün bir istifadəçi bir dəfə; saatlıq 10, gündəlik 30 limit; öz məzmununu şikayət etmək olmur.
- **Bildirişlər:** mövzuya və ya cavaba yeni cavab gələndə sayt daxilində (`/notifications`, zəng ikonu). E-poçt bildirişi **yoxdur** (e-poçt infrastrukturu qurulmayıb).

## Server tərəfi qoruma
Forum cədvəllərinə brauzerdən birbaşa yazmaq qadağandır; bütün yazma `SECURITY DEFINER` RPC-lərlə gedir (`forum_create_topic`, `forum_create_reply`, ...). Orada yoxlanılır: giriş, blok, uzunluq, `<script>/<iframe>`/`javascript:` rədd, ≤5 keçid, təkrarlanan simvol spamı, **10 mövzu/saat, 30 cavab/saat**, eyni məzmunun təkrarı, paralel/təkrar klik (advisory lock). Mətn React ilə mətn kimi göstərilir (HTML kimi yox); yalnız `https://` keçidlər aktivləşir (`javascript:`, `data:`, `http:` yox).

## Admin imkanları
`/admin/forum`, `/admin/reports`, `/admin/categories`: istənilən mövzu/cavabı gizlət, sil, bərpa et, redaktə et; mövzunu sabitlə/bağla; şikayətləri araşdır və nəticə qeyd et; kateqoriya yarat, adını dəyiş, **təhlükəsiz deaktiv et** (mövcud mövzular qalır). Bütün əməliyyatlar audit jurnalındadır.

## Çat ilə münasibət
Mövcud `/chat` istifadəçilər arası şəxsi mesajlaşmadır və forum üçün uyğun deyil; o olduğu kimi saxlanılıb (silinməyib, dəyişdirilməyib). Forum ayrıca cədvəllərdədir.

## Məhdudiyyətlər
Fayl/şəkil əlavəsi yoxdur (ilk versiyada saxlama və zərərli fayl riskini artırmamaq üçün). Cavab zənciri bir səviyyədir. E-poçt bildirişi yoxdur.
