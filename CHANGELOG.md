# Dəyişikliklər

## v6.0
- Yeni `/feed` mətnli sosial səhifəsi: paylaşım, like, şərh, müəllif profili, təhlükəsiz URL linkləri.
- Additive `09_social_trust_views.sql`: Feed, rəy, doğrulama müraciəti və rate-limited view event sxemləri/RLS.
- DEPLOY, migration, admin, forum, feed, verification, quiz təlimatları əlavə edildi.
- v5 login, profile, forum, PDF/books, chat, AdSense və SEO kodu saxlanıldı.

## v6.1
- Test düzgün cavab sızmasının qarşısı alındı; cavablar yekun təqdimatda serverdə hesablanır.
- Müəllim rəyləri, doğrulama müraciətləri/admin qərarları, global search, universal bookmark, Feed bildirişləri və V6 admin statistikası tamamlandı.
- Qonaq baxışları server API + imzalı HttpOnly cookie ilə qeydə alınır.
- Əlavə `10_workflows_and_quiz_security.sql` miqrasiyası; tətbiq sırası 09 → 10.
- Quiz sessiyalarında server deadline, cavab autosave-i və davametmə əlavə edildi.
- Admin analitikasına 7/30/90 günlük qrafik, Feed populyarlığına qlobal server sıralaması əlavə edildi.
- Kitab/PDF favoritləri universal yadda saxlanılanlarla sinxronlaşdırıldı; axtarış bütün əsas məzmun növlərini əhatə edir.

## v6.2
- 09/10 miqrasiyalarında PostgREST schema cache yenilənməsi əlavə edildi.
- Axtarış RPC-si parametr adı uyğunsuzluğu olan köhnə DB funksiyasından təhlükəsiz şəkildə yenidən yaradılır.
- Yeni 11-ci uyğunluq miqrasiyası, Supabase REST diaqnostikası və digər modulların schema/RPC auditi əlavə edildi.
