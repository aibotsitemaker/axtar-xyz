# Onlayn sınaq sistemi

v5-də mövcud sınaq yaratma və nəticə tarixçəsi qorunub. `10_workflows_and_quiz_security.sql` cavab açarlarını REST API-dən gizlədir və balı serverdə hesablayır. İstifadəçi sınağa başladıqda server sessiyası və bitmə vaxtı yaradılır; cavablar avtomatik saxlanır və səhifə yenilənəndə aktiv sessiya bərpa olunur. Yekun sorğu idempotentdir. Adminlər v5-in admin RPC-ləri ilə test yaradır.

v6.3-də suallar arasında keçid etmək və əvvəlki cavabı dəyişmək mümkündür. İnternet müvəqqəti kəsilərsə, seçimlər brauzerin `localStorage` yaddaşında saxlanır və bağlantı bərpa olunanda göndərilir; buna görə şəxsi cihazdan istifadə edin. Nəticə göndərilməzsə, sınaq sessiyası yenidən açıldıqda cavablar serverə ötürülür. Nəticə təhvil verildikdən sonra hər sual üçün düzgün cavab və izah göstərilir. 12-ci miqrasiya `quiz_session_review` funksiyasını və vaxtı bitmiş sessiyaların nəticəyə çevrilməsi qaydasını əlavə edir.

## v6.4 sual formatları və müəllim sınaqları

13-cü miqrasiya köhnə sınaq məlumatını dəyişmədən beş format əlavə edir: bir düzgün variant, çoxseçimli variantlar, doğru/yanlış, qısa mətn və rəqəm/riyaziyyat cavabı. Hər sual 0-dan böyük, maksimum 100 bal alır. Mətn cavabı boşluq və böyük/kiçik hərf fərqləri nəzərə alınmadan; rəqəm cavabı müəllimin verdiyi tolerantlıq daxilində serverdə yoxlanır. Çoxseçimli sualda yalnız cavab dəsti tam uyğun gələndə bal verilir.

Müəllim menyusundakı **Sınaqlarımı idarə et** bölməsində sınaq və sualları yaradıb qaralama kimi saxlamaq, dərc etmək üçün isə **Dərc et** düyməsini basmaq mümkündür. Yaradılma və yayımlama `teacher_create_quiz` və `teacher_publish_quiz` RPC-ləri ilə serverdə icazə yoxlanılaraq icra olunur. Admin məzmun bölməsində də sual formatlarını seçmək mümkündür. Sınaq cavab açarları PostgREST-də oxuna bilmir; yekun nəticə `finish_quiz_session_v2` server RPC-si ilə hesablanır və izahlı baxış yalnız yekundan sonra `quiz_session_review_v2` ilə qaytarılır. Köhnə `start_quiz_session`, `save_quiz_session_answer`, `finish_quiz_session` və `quiz_session_review` RPC-ləri saxlanılıb; onlar əvvəlki tipli sınaqlarla geriyə uyğunluğu qoruyur.
