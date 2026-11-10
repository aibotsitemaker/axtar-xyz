# Onlayn sınaq sistemi

v5-də mövcud sınaq yaratma və nəticə tarixçəsi qorunub. `10_workflows_and_quiz_security.sql` cavab açarlarını REST API-dən gizlədir və balı serverdə hesablayır. İstifadəçi sınağa başladıqda server sessiyası və bitmə vaxtı yaradılır; cavablar avtomatik saxlanır və səhifə yenilənəndə aktiv sessiya bərpa olunur. Yekun sorğu idempotentdir. Adminlər v5-in admin RPC-ləri ilə test yaradır.

v6.3-də suallar arasında keçid etmək və əvvəlki cavabı dəyişmək mümkündür. İnternet müvəqqəti kəsilərsə, seçimlər brauzerin `localStorage` yaddaşında saxlanır və bağlantı bərpa olunanda göndərilir; buna görə şəxsi cihazdan istifadə edin. Nəticə göndərilməzsə, sınaq sessiyası yenidən açıldıqda cavablar serverə ötürülür. Nəticə təhvil verildikdən sonra hər sual üçün düzgün cavab və izah göstərilir. 12-ci miqrasiya `quiz_session_review` funksiyasını və vaxtı bitmiş sessiyaların nəticəyə çevrilməsi qaydasını əlavə edir.
