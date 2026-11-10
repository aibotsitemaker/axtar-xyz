# Doğrulanmış hesablar

İstifadəçi müraciətləri `verification_requests` cədvəlində saxlanılır və yalnız müraciət sahibi/admin görə bilər. Admin müraciətləri Supabase-də nəzərdən keçirib `status`, `admin_note`, `reviewed_by` və `reviewed_at` sahələrini yeniləyə bilər; yalnız serverin admin səlahiyyətləri ilə işləməlidir. Doğrulama nişanı `profiles.is_verified` sahəsinə bağlıdır. Bu versiyada ayrıca müraciət forması və admin UI tam qurulmayıb; həssas sənəd yükləməsi yoxdur.
