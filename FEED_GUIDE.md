# TəhsilHub Feed

Feed forumdan ayrı `/feed` səhifəsidir. Daxil olmuş istifadəçilər 500 simvoladək mətn paylaşa, redaktə və silə, bəyənə, şərhə cavab yaza, link köçürə və məzmunu yadda saxlaya bilərlər. Ən yeni və populyar sıralama var. URL-lər yalnız `http` və `https` olduqda linkə çevrilir. Fayl yükləmə yoxdur. RLS yalnız müəllifə öz paylaşımını dəyişməyə icazə verir. Bildirişlər `/notifications` bölməsinə düşür.

## Şəkil, sual və sorğu paylaşımı (v6.7)

14-cü migration tətbiq edildikdən sonra paylaşım forması mətn, şəkil, sual və sorğu formatlarını dəstəkləyir. Şəkillər JPG/PNG/WebP, hər biri ən çox 5 MB və paylaşım başına 4 fayla qədərdir. Server fayl imzasını yoxlayır; Storage-da hər hesab yalnız öz qovluğuna yaza bilir. Yükləmələr saatda 20 ilə limitlənir. Sorğular 2–6 variant qəbul edir; daxil olmuş istifadəçi səsini dəyişə bilər, nəticə faizləri server RPC-sində hesablanır. Feed əvvəlki mətn postlarını olduğu kimi saxlayır.
