import { Link } from 'react-router-dom'

export default function Gizlilik() {
  return (
    <div className="page-wrap" style={{ maxWidth: 800 }}>
      <Link to="/" style={{ color: '#185FA5', textDecoration: 'none', fontSize: 14 }}>← Ana səhifə</Link>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '20px 0 8px' }}>Gizlilik Siyasəti</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 32 }}>Son yenilənmə: Yanvar 2025</p>

      {[
        ['1. Giriş', 'Axtar.xyz ("biz", "bizim") sizin məxfiliyinizi qorumağa sadiqdir. Bu Gizlilik Siyasəti Axtar.xyz platformasından istifadə edərkən məlumatlarınızın necə toplandığını, istifadə edildiyini və qorunduğunu izah edir.'],
        ['2. Toplanan məlumatlar', 'Qeydiyyat zamanı ad, soyad, e-poçt ünvanı, telefon nömrəsi və şəhər məlumatlarınızı toplayırıq. Platforma istifadəsi zamanı elanlar, mesajlar və rəylər kimi fəaliyyət məlumatları da saxlanılır. Texniki məlumatlar olaraq IP ünvanı, brauzer növü və cihaz məlumatları avtomatik toplanır.'],
        ['3. Məlumatların istifadəsi', 'Topladığımız məlumatları aşağıdakı məqsədlər üçün istifadə edirik: platformanın işləməsini təmin etmək, istifadəçilər arasında əlaqəni asanlaşdırmaq, xidməti təkmilləşdirmək, təhlükəsizliyi qorumaq və qanuni öhdəliklərimizi yerinə yetirmək.'],
        ['4. Məlumatların paylaşılması', 'Şəxsi məlumatlarınızı üçüncü tərəflərlə satmırıq. Məlumatlar yalnız xidmət göstəricilər (hosting, verilənlər bazası), qanuni tələblər və sizin razılığınız olduqda paylaşıla bilər.'],
        ['5. Çərəzlər (Cookies)', 'Platforma düzgün işləmək üçün çərəzlərdən istifadə edir. Bunlara giriş məlumatları, istifadəçi tercihlərini yadda saxlayan çərəzlər daxildir. Brauzer ayarlarınızdan çərəzləri idarə edə bilərsiniz.'],
        ['6. Məlumat təhlükəsizliyi', 'Məlumatlarınızı qorumaq üçün sənaye standartı təhlükəsizlik tədbirləri tətbiq edirik. Bütün məlumatlar şifrəli şəkildə saxlanılır və HTTPS protokolu ilə ötürülür.'],
        ['7. Uşaqların məxfiliyi', 'Platformamız 18 yaşdan yuxarı şəxslər üçün nəzərdə tutulub. Bilərəkdən 18 yaşdan kiçik şəxslərdən məlumat toplamırıq.'],
        ['8. Sizin hüquqlarınız', 'Şəxsi məlumatlarınıza daxil olmaq, düzəltmək və ya silmək hüququnuz var. Bu hüquqlardan istifadə etmək üçün aşağıdakı əlaqə vasitəsilə bizimlə əlaqə saxlayın.'],
        ['9. Dəyişikliklər', 'Bu siyasəti zaman-zaman yeniləyə bilərik. Əhəmiyyətli dəyişikliklər olduqda sizi e-poçt vasitəsilə məlumatlandıracağıq.'],
        ['10. Əlaqə', 'Gizlilik siyasəti ilə bağlı suallarınız üçün: elielizade17@gmail.com ünvanına yazın.'],
      ].map(([title, text]) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10, color: '#185FA5' }}>{title}</h2>
          <p style={{ fontSize: 14, color: '#444', lineHeight: 1.8 }}>{text}</p>
        </div>
      ))}
    </div>
  )
}
