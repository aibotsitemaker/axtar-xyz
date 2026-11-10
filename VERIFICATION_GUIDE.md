# Doğrulanmış hesablar

İstifadəçi Kabinet → Profil bölməsindən müraciət göndərir və öz statusunu görür. Admin `/admin/verification` səhifəsində müraciəti təsdiq, rədd, əlavə məlumat tələb et və ya ləğv edə bilər. Qərar `profiles.is_verified` nişanını server trigger-i ilə yeniləyir və istifadəçiyə bildiriş göndərir. Həssas sənəd yükləməsi bu versiyada yoxdur.
