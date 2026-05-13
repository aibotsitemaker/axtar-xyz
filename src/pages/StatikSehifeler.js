import { Link } from 'react-router-dom'

export function Gizlilik() {
  return (
    <div className="page-wrap max-w-3xl">
      <Link to="/" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">← Ana səhifə</Link>
      <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-2">Gizlilik Siyasəti</h1>
      <p className="text-sm text-gray-400 mb-8">Son yenilənmə: Yanvar 2025</p>
      <div className="space-y-6">
        {[
          ['1. Giriş', 'Axtar.xyz sizin məxfiliyinizi qorumağa sadiqdir. Bu Gizlilik Siyasəti platformamızdan istifadə edərkən məlumatlarınızın necə toplandığını və qorunduğunu izah edir.'],
          ['2. Toplanan məlumatlar', 'Qeydiyyat zamanı ad, e-poçt, telefon və şəhər məlumatlarınızı toplayırıq. Platforma istifadəsi zamanı elanlar, mesajlar və rəylər kimi fəaliyyət məlumatları da saxlanılır.'],
          ['3. Məlumatların istifadəsi', 'Topladığımız məlumatları platformanın işləməsini təmin etmək, istifadəçilər arasında əlaqəni asanlaşdırmaq və xidməti təkmilləşdirmək üçün istifadə edirik.'],
          ['4. Məlumatların paylaşılması', 'Şəxsi məlumatlarınızı üçüncü tərəflərlə satmırıq. Məlumatlar yalnız qanuni tələblər zamanı paylaşıla bilər.'],
          ['5. Təhlükəsizlik', 'Bütün məlumatlar şifrəli şəkildə saxlanılır və HTTPS protokolu ilə ötürülür. Supabase-in sənaye standartı təhlükəsizlik tədbirlərindən istifadə edirik.'],
          ['6. Uşaqların məxfiliyi', 'Platformamız 18 yaşdan yuxarı şəxslər üçün nəzərdə tutulub.'],
          ['7. Hüquqlarınız', 'Şəxsi məlumatlarınıza daxil olmaq, düzəltmək və ya silmək hüququnuz var. Əlaqə vasitəsilə bizimlə əlaqə saxlayın.'],
          ['8. Əlaqə', 'Suallarınız üçün: elielizade17@gmail.com'],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <h2 className="font-semibold text-primary-600 mb-2">{t}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Elaqe() {
  return (
    <div className="page-wrap max-w-3xl">
      <Link to="/" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">← Ana səhifə</Link>
      <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-2">Əlaqə</h1>
      <p className="text-gray-500 text-sm mb-8">Suallarınız üçün bizimlə əlaqə saxlayın</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Əlaqə məlumatları</h3>
            {[['📧', 'E-poçt', 'elielizade17@gmail.com'], ['🌐', 'Sayt', 'axtar.xyz'], ['📍', 'Ölkə', 'Azərbaycan, Bakı']].map(([ikon, label, val]) => (
              <div key={label} className="flex items-center gap-3 mb-4 last:mb-0">
                <span className="text-2xl">{ikon}</span>
                <div>
                  <div className="text-xs text-gray-400">{label}</div>
                  <div className="text-sm font-medium text-gray-800">{val}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-5 bg-primary-50 border-primary-100">
            <h3 className="font-semibold text-primary-700 mb-2">İş saatları</h3>
            <p className="text-sm text-primary-600 leading-relaxed">B.ertəsi – Cümə: 09:00 – 18:00<br />Şənbə: 10:00 – 15:00<br />Bazar: İstirahət</p>
          </div>
        </div>
        <div>
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Tez-tez verilən suallar</h3>
            {[
              ['Qeydiyyat pulsuzdurmu?', 'Bəli, müştəri qeydiyyatı tamamilə pulsuzdur.'],
              ['Mütəxəssis necə qeydiyyatdan keçə bilər?', '"Qeydiyyat" → "Mütəxəssis" seçib məlumatları daxil edin.'],
              ['Müştərilərlə əlaqə necə qurulur?', 'Mütəxəssis profilinə baxıb birbaşa mesaj göndərə bilərsiniz.'],
              ['Elan vermək pulsuzdurmu?', 'Hazırda bütün elanlar pulsuzdur.'],
            ].map(([s, c]) => (
              <div key={s} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-0 border-gray-50">
                <p className="text-sm font-semibold text-primary-600 mb-1">❓ {s}</p>
                <p className="text-sm text-gray-600">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
