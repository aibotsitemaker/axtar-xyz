# Onlayn sınaq sistemi

v5-də admin tərəfindən yaradılmış testlər, taymer, server RPC ilə cavab yoxlama və nəticə tarixçəsi mövcuddur. Bu paketin auditi göstərdi ki, `check_answer` RPC düzgün cavab indeksini və izahı hər sualdan sonra brauzerə qaytarır; beləliklə cavablar test bitmədən görünür. İstifadədən əvvəl bu RPC-ni yalnız test yekunlaşandan sonra nəticə qaytaracaq axına dəyişmək lazımdır. Bu dəyişiklik bu iterasiyada tamamlanmayıb; aşağıdakı TEST_REPORT.md-də məhdudiyyət qeyd olunub.
