# Forumdan istifadə qaydası

- `/forum` səhifəsində qonaqlar mövzuları oxuya, axtara və kateqoriyaya görə süzə bilər. Yazmaq üçün hesaba daxil olmaq lazımdır.
- Yeni mövzu üçün 8–160 simvolluq başlıq, kateqoriya və 10–12 000 simvolluq mətn tələb olunur. HTML və skript icra edilmir; mətn təhlükəsiz şəkildə göstərilir.
- Mövzu limiti saatda 10, cavab limiti saatda 30-dur. Eyni mətnin 24 saat içində təkrarı qadağandır. Yoxlamalar PostgreSQL trigger-lərində aparılır.
- Mövzunun sahibi başlığı, mətni və kateqoriyanı redaktə edə, mövzunu yumşaq silə bilər. İstifadəçi öz cavabını redaktə və yumşaq silə bilər. Admin mövzunu gizlədə/bərpa edə, sabitləyə, bağlaya və şikayətə baxa bilər.
- Hesab silindikdə müzakirələr saxlanılır və müəllif bağlantısı anonimləşdirilir.
- Mövzu səhifəsi Supabase Realtime vasitəsilə yeni cavabları alır. Mövzu sahibinə və cavabına cavab yazılan istifadəçiyə sayt daxili bildiriş yaradılır. E-poçt bildirişi qurulmayıb.
- Mövzuya maksimum 4 JPG, PNG, WEBP və ya PDF faylı əlavə etmək olar; hər fayl 5 MiB-dəkdir. Fayllar şəxsi Storage bucket-də saxlanır və görünən mövzu üçün qısaömürlü imzalı keçidlə açılır.
- Cavablar tarixə görə göstərilir. İlk versiyada cavab zəncirinin interfeysi bir səviyyəlidir; bazadakı `parent_id` sahəsi məhdud zəncirləri dəstəkləyir.
- Admin kateqoriyanı deaktiv edə bilər. İstifadə olunan kateqoriyanı silmək əvəzinə deaktiv etmək məsləhətdir.
- RLS icazələri verilənlər bazasında qoruyur. Oxumaq açıqdır; yazmaq və idarə etmək autentifikasiya, sahiblik və admin reyestri ilə məhdudlaşır.
