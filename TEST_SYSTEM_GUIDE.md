# Onlayn sınaq sistemi

v5-də mövcud test yaratma və nəticə tarixçəsi qorunub. `10_workflows_and_quiz_security.sql` `check_answer` icazəsini ləğv edir, REST-dən `correct_index` və `explanation` sütunlarını gizlədir və balı serverdə hesablayır. İstifadəçi sınağa başladıqda server sessiyası və bitmə vaxtı yaradılır; cavablar hər seçimdə saxlanır və səhifə yenilənəndə aktiv sessiya bərpa olunur. Yekun sorğu idempotentdir. Adminlər v5-in admin RPC-ləri ilə test yaradır.
