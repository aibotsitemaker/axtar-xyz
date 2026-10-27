// Yalnız sınaq üçün: PostgREST/Auth/Storage cavablarını təqlid edən saxta server.
import http from 'http';
const now = new Date().toISOString();
const me = { id: 'u1', full_name: 'Əli Əliyev', city: 'Bakı', bio: 'Tələbə', created_at: now };
const book = (i, t, p, c, city, st = 'active') => ({ id: 'b' + i, seller_id: i % 2 ? 'u2' : 'u1', title: t, author: 'Müəllif ' + i, description: 'Təsvir', category: c, condition: 'Yaxşı', price: p, city, metro: '28 May', image_urls: [], whatsapp: '0501234567', status: st, view_count: i * 3, created_at: now, profiles: { full_name: i % 2 ? 'Nigar Həsənova' : 'Əli Əliyev' } });
const books = [book(1, 'Riyaziyyat 11-ci sinif DİM hazırlıq testləri', 12, 'DİM', 'Bakı'), book(2, 'IELTS Cambridge 17', 18.5, 'IELTS', 'Bakı'), book(3, 'Fizika məsələlər toplusu', 9, 'Universitet', 'Gəncə'), book(4, 'Azərbaycan dili qrammatika', 7, 'DİM', 'Sumqayıt'), book(5, 'Magistr qəbul imtahanı məntiq', 14, 'Magistr', 'Bakı'), book(6, 'English Grammar in Use', 16, 'IELTS', 'Bakı')];
const pdf = (i, t, l, s, y) => ({ id: 'p' + i, uploader_id: 'u2', title: t, description: 'Buraxılış imtahanına hazırlaşanlar üçün sınaq testləri', level: l, subject: s, year: y, file_url: 'https://example.com/f.pdf', file_size_kb: 2048 + i * 100, view_count: i * 5, download_count: i * 2, status: 'active', created_at: now, profiles: { full_name: 'Nigar Həsənova' } });
const pdfs = [pdf(1, 'Nərgiz Nəcəf — 250 sınaq testi', 'DİM', 'İngilis dili', 2026), pdf(2, 'Riyaziyyat konspekti', 'Bakalavr', 'Riyaziyyat', 2025), pdf(3, 'IELTS Writing nümunələri', 'IELTS', 'İngilis dili', 2024), pdf(4, 'Fizika düsturlar toplusu', 'DİM', 'Fizika', 2025)];
const quizzes = [['q1', 'DİM Riyaziyyat — Sürətli Yoxlama', 'DİM'], ['q2', 'IELTS Grammar — Əsaslar', 'IELTS'], ['q3', 'Magistr Məntiq — Giriş Səviyyəsi', 'Magistr']].map(([id, title, category]) => ({ id, title, category, description: 'Əsas bilikləri yoxlayan qısa test.', duration_seconds: 300, is_published: true, created_at: now, quiz_questions: [{ count: 5 }] }));
const questions = [1, 2, 3, 4, 5].map((n) => ({ id: 'qq' + n, quiz_id: 'q1', position: n, question_text: `Sual ${n}: 2x + 6 = 20 tənliyində x neçədir? (Bu mətn mobil ekranda sətirlərə bölünməlidir və daşmamalıdır.)`, options: ['5', '6', '7', '8'] }));
const attempts = [{ id: 'a1', correct_count: 4, total_questions: 5, score_percent: 80, seconds_used: 95, created_at: now, quizzes: { title: 'DİM Riyaziyyat — Sürətli Yoxlama' } }, { id: 'a2', correct_count: 2, total_questions: 5, score_percent: 40, seconds_used: 160, created_at: now, quizzes: { title: 'IELTS Grammar — Əsaslar' } }];
const favs = [{ id: 'f1', user_id: 'u1', item_type: 'book', book_id: 'b1', pdf_id: null, created_at: now, books: books[0], pdfs: null }, { id: 'f2', user_id: 'u1', item_type: 'pdf', book_id: null, pdf_id: 'p1', created_at: now, books: null, pdfs: pdfs[0] }];
const convs = [{ id: 'c1', user_a: 'u1', user_b: 'u2', book_id: 'b1', created_at: now, books: { title: books[0].title } }];
const msgs = [['u2', 'Salam, kitab hələ satılıbmı?', true], ['u1', 'Salam, xeyr, hələ satılmayıb.', true], ['u2', 'Əla, sabah görüşə bilərikmi?', false], ['u1', '28 May metrosunda saat 18:00-da.', false]].map(([s, c, r], i) => ({ id: 'm' + i, conversation_id: 'c1', sender_id: s, content: c, is_read: r, created_at: new Date(Date.now() - (4 - i) * 60000).toISOString() }));
const legal = { id: 'l1', doc_type: 'privacy_policy', title: 'Məxfilik Siyasəti', version: '1.0', language: 'az', effective_date: '2026-10-18', is_active: true, content: '# Məxfilik Siyasəti\n\n**Qüvvəyə minmə tarixi:** 18 oktyabr 2026\n\nBu siyasət şəxsi məlumatların necə işləndiyini izah edir.\n\n## 1. Toplanan məlumatlar\n\n- Qeydiyyat zamanı: ad-soyad, e-poçt ünvanı.\n- **Avtomatik** toplanan məlumatlar: IP ünvanı, brauzer növü.\n\n## 2. İstifadə məqsədləri\n\n- Hesabınızı yaratmaq və idarə etmək;\n- Xidmətin təhlükəsizliyini qorumaq.\n' };
const tables = { books, pdfs, quizzes, quiz_questions: questions, quiz_attempts: attempts, favorites: favs, conversations: convs, chat_messages: msgs, profiles: [me, { id: 'u2', full_name: 'Nigar Həsənova' }], privacy_policy_terms: [legal] };
const log = [];
http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  log.push(`${req.method} ${url.pathname}${url.search.slice(0, 260)}`);
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const single = (req.headers.accept || '').includes('vnd.pgrst.object');
    if (url.pathname === '/__log') return send(200, log.slice(-80));
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop();
      const a = body ? JSON.parse(body) : {};
      if (fn === 'unread_message_count') return send(200, 2);
      if (fn === 'check_answer') return send(200, [{ r_correct: a.p_picked === 2, r_index: 2, r_explanation: 'Tənliyi həll edək: 2x = 14, deməli x = 7.' }]);
      if (fn === 'submit_quiz_attempt') return send(200, [{ r_correct: 3, r_total: 5, r_percent: 60 }]);
      if (fn === 'get_or_create_conversation') return send(200, 'c1');
      return send(200, null);
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const t = url.pathname.split('/')[3];
      if (req.method === 'GET') {
        let rows = tables[t] || [];
        if (t === 'privacy_policy_terms') rows = [legal];
        if (t === 'profiles' && url.searchParams.get('id') && !url.searchParams.get('id').startsWith('in.')) rows = [me];
        if (t === 'books' && url.searchParams.get('seller_id')) rows = books.filter((b) => b.seller_id === 'u1');
        if (t === 'pdfs' && url.searchParams.get('uploader_id')) rows = pdfs.slice(0, 2);
        if (single) return rows[0] ? send(200, rows[0]) : send(406, { message: 'no rows' });
        return send(200, rows);
      }
      if (req.method === 'POST') return send(201, single ? (t === 'chat_messages' ? { id: 'm' + Date.now(), conversation_id: 'c1', sender_id: 'u1', content: JSON.parse(body).content, is_read: false, created_at: new Date().toISOString() } : {}) : []);
      return send(204);
    }
    if (url.pathname.startsWith('/storage/v1/')) return send(200, []);
    if (url.pathname.startsWith('/auth/v1/user')) return send(200, { id: 'u1', aud: 'authenticated', email: 'ali@test.az', user_metadata: { full_name: 'Əli Əliyev' } });
    if (url.pathname.startsWith('/auth/v1/logout')) return send(204);
    return send(404, { message: 'mock: not found' });
  });
}).listen(54321, () => console.log('mock on 54321'));
