import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const BASE = 'http://localhost:3070';
const STAGE = process.env.STAGE;
const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', exp: 4102444800, aud: 'authenticated' })}.sig`;
const session = JSON.stringify({ access_token: jwt, refresh_token: 'r', expires_in: 3600, expires_at: 4102444800, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'ali@test.az', user_metadata: { full_name: 'Əli Əliyev' }, app_metadata: {} } });

const results = []; const consoleIssues = []; const axeOut = [];
const rec = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail: String(detail).slice(0, 200) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' });

async function open(path, { w = 1280, h = 800, auth = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
  if (auth) await page.evaluateOnNewDocument((s) => localStorage.setItem('sb-localhost-auth-token', s), session);
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Report Only|WebSocket|realtime|ERR_CONNECTION_REFUSED.*54321.*websocket/i.test(t)) return;
    consoleIssues.push({ path, w, t: t.slice(0, 160) });
  });
  page.on('pageerror', (e) => consoleIssues.push({ path, w, t: 'PAGEERROR ' + String(e.message).slice(0, 160) }));
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);
  return page;
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const clickText = (page, sel, text) => page.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t)); if (!el) return false; el.click(); return true; }, sel, text);
const hasText = (page, text) => page.evaluate((t) => document.body.innerText.includes(t), text);
const shot = (page, name, full = false) => page.screenshot({ path: `out/${name}.jpg`, type: 'jpeg', quality: 78, fullPage: full });

if (STAGE === 'layout') {
// ---------- 1) Hər marşrut x 4 ekran: üfüqi scroll, h1 sayı, alt-sız şəkil
const OUT = ['/', '/auth', '/auth?mode=register', '/auth/reset', '/books', '/pdfs', '/quizzes', '/legal/privacy', '/legal/terms', '/nope'];
const IN = ['/profile', '/chat', '/chat?c=c1', '/books', '/pdfs', '/quizzes', '/'];
const VPS = [[360, 740], [390, 844], [768, 1024], [1280, 800]];
for (const [w, h] of VPS) {
  for (const [list, auth] of [[OUT, false], [IN, true]]) {
    for (const p of list) {
      const page = await open(p, { w, h, auth });
      const ov = await overflow(page);
      const h1 = await page.evaluate(() => document.querySelectorAll('h1').length);
      const noAlt = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length);
      rec(`layout ${auth ? '[giriş]' : ''} ${p} @${w}`, ov <= 0 && h1 === 1 && noAlt === 0, `overflow=${ov} h1=${h1} imgWithoutAlt=${noAlt}`);
      await page.close();
    }
  }
}

}
if (STAGE === 'shots') {
// ---------- 2) Ekran görüntüləri
const SH = [
  ['home', '/', false, true], ['auth', '/auth?mode=register', false, false], ['books', '/books', true, true], ['pdfs', '/pdfs', true, false],
  ['quizzes', '/quizzes', false, false], ['legal', '/legal/privacy', false, false], ['profile', '/profile', true, false], ['chat', '/chat?c=c1', true, false], ['404', '/nope', false, false]
];
for (const [name, path, auth, full] of SH) {
  for (const [tag, w, h] of [['mobile', 390, 844], ['desktop', 1280, 800]]) {
    const page = await open(path, { w, h, auth });
    await shot(page, `${name}-${tag}`, full && tag === 'mobile');
    await page.close();
  }
}
{ const page = await open('/pdfs', { w: 768, h: 1024, auth: true }); await shot(page, 'pdfs-tablet'); await page.close(); }

}
if (STAGE === 'interact') {
// ---------- 3) İnteraksiyalar (mobil 390)
{ // hamburger menyu
  const page = await open('/', { w: 390, h: 844 });
  const before = await page.$('#mobile-menu');
  await page.click('button[aria-label="Menyunu aç"]'); await sleep(200);
  const links = await page.evaluate(() => document.querySelectorAll('#mobile-menu a').length);
  const exp = await page.evaluate(() => document.querySelector('button[aria-controls="mobile-menu"]').getAttribute('aria-expanded'));
  await shot(page, 'menu-mobile');
  rec('hamburger: menyu açılır (7 keçid, aria-expanded=true)', !before && links === 7 && exp === 'true', `links=${links} exp=${exp}`);
  await clickText(page, '#mobile-menu a', 'Sınaqlar'); await sleep(900);
  rec('hamburger: keçiddən sonra səhifə dəyişir və menyu bağlanır', page.url().endsWith('/quizzes') && !(await page.$('#mobile-menu')), page.url());
  await page.close();
}
{ // skip link
  const page = await open('/', { w: 1280, h: 800 });
  await page.keyboard.press('Tab');
  const sk = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { t: a.textContent.trim(), vis: r.width > 0 && r.top >= 0 }; });
  rec('klaviatura: ilk Tab "Əsas məzmuna keç" keçidini göstərir', sk.t.includes('Əsas məzmuna keç') && sk.vis, JSON.stringify(sk));
  await page.close();
}
{ // ana səhifə məzmunu (real məlumat var -> bölmələr, CTA)
  const page = await open('/', { w: 1280, h: 800 });
  const ok = (await hasText(page, 'Təhsil üçün lazım olan hər şey bir yerdə!')) && (await hasText(page, 'Son sınaqlar')) && (await hasText(page, 'Son kitab elanları')) && (await hasText(page, 'Yeni PDF resurslar')) && (await hasText(page, 'Pulsuz hesab yaradın'));
  rec('ana səhifə: hero, 3 canlı bölmə və giriş CTA göstərilir', ok);
  rec('ana səhifə: boş AdSlot production-da heç nə göstərmir', !(await hasText(page, 'Reklam yeri')));
  await page.close();
}
{ // auth
  const page = await open('/auth', { w: 390, h: 844 });
  await clickText(page, '[role=tab]', 'Qeydiyyat'); await sleep(150);
  rec('auth: Qeydiyyat tabı formu dəyişir', await hasText(page, 'Hesab yaradın'));
  const t1 = await page.$eval('#password', (e) => e.type); await page.click('button[aria-label="Parolu göstər"]'); const t2 = await page.$eval('#password', (e) => e.type);
  rec('auth: parolu göstər/gizlət işləyir', t1 === 'password' && t2 === 'text', `${t1}->${t2}`);
  await page.type('#name', 'Test İstifadəçi'); await page.type('#email', 'a@b.az'); await page.type('#password', 'parol12345');
  await page.click('form button.btn-primary'); await sleep(300);
  rec('auth: razılıq olmadan göndərmə xəta mesajı verir', await hasText(page, 'şərtlərlə razılaşmalısınız'));
  await shot(page, 'auth-error-mobile');
  await page.close();
}
{ // kitablar
  const page = await open('/books', { w: 390, h: 844, auth: true });
  const cards = await page.evaluate(() => document.querySelectorAll('article').length);
  const catHidden = await page.evaluate(() => { const s = document.querySelector('select[aria-label="Kateqoriya"]'); return s.offsetParent === null; });
  await clickText(page, 'button', 'Filtr'); await sleep(150);
  const catShown = await page.evaluate(() => document.querySelector('select[aria-label="Kateqoriya"]').offsetParent !== null);
  rec('kitablar: 6 kart; mobil filtr düyməsi kateqoriya sahəsini açır', cards === 6 && catHidden && catShown, `cards=${cards} hidden=${catHidden} shown=${catShown}`);
  await page.type('input[aria-label="Kitab axtar"]', 'IELTS'); await sleep(700);
  const log = await (await fetch('http://localhost:54321/__log')).json();
  rec('kitablar: axtarış serverə ilike sorğusu göndərir', log.some((l) => l.includes('/rest/v1/books') && l.includes('ilike')));
  await page.evaluate(() => window.scrollTo(0, 0));
  const pressed0 = await page.$$eval('article button[aria-pressed]', (b) => b.map((x) => x.getAttribute('aria-pressed')));
  await page.$$eval('article button[aria-pressed="false"]', (b) => b[0].click()); await sleep(400);
  const pressed1 = await page.$$eval('article button[aria-pressed]', (b) => b.map((x) => x.getAttribute('aria-pressed')));
  rec('kitablar: favori düyməsi vəziyyəti dəyişir (aria-pressed)', pressed1.filter((x) => x === 'true').length === pressed0.filter((x) => x === 'true').length + 1, `${pressed0.join(',')} -> ${pressed1.join(',')}`);
  await page.close();
}
{ // sınaq axını (giriş etmiş)
  const page = await open('/quizzes', { w: 390, h: 844, auth: true });
  await clickText(page, 'button', 'Başla'); await page.waitForSelector('[role=group] button'); await sleep(200);
  await shot(page, 'quiz-question-mobile');
  const opts = await page.$$('[role=group] button'); await opts[0].click(); await sleep(400);
  const wrong = await hasText(page, 'Səhv cavab') && await hasText(page, 'x = 7');
  await shot(page, 'quiz-feedback-mobile');
  rec('sınaq: səhv cavab dərhal göstərilir + izah (serverdən)', wrong);
  let guard = 0;
  while (guard++ < 12) {
    const nextBtn = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Növbəti sual|Nəticəni gör/.test(b.textContent)) ? true : false);
    if (nextBtn) { await clickText(page, 'button', /Nəticəni/.test(await page.evaluate(() => document.body.innerText)) ? 'Nəticəni gör' : 'Növbəti sual'); await sleep(250); }
    const res = await hasText(page, 'Nəticə kabinetinizdə') || await hasText(page, 'Nəticə saxlanılır');
    if (res) break;
    const o = await page.$$('[role=group] button'); if (o[2]) { await o[2].click(); await sleep(350); }
  }
  await sleep(500);
  const final = await hasText(page, 'Düzgün') && await hasText(page, 'Yenidən başla');
  await shot(page, 'quiz-result-mobile');
  const log = await (await fetch('http://localhost:54321/__log')).json();
  rec('sınaq: tam axın nəticə panelinə çatır', final);
  rec('sınaq: nəticə serverə submit_quiz_attempt RPC ilə göndərilir (klientdə INSERT yoxdur)', log.some((l) => l.includes('rpc/submit_quiz_attempt')) && !log.some((l) => l.startsWith('POST /rest/v1/quiz_attempts')));
  rec('sınaq: klient correct_index sorğulamır', !log.some((l) => l.includes('correct_index')));
  await page.close();
}
{ // çat (mobil)
  const page = await open('/chat', { w: 390, h: 844, auth: true });
  const listVisible = await hasText(page, 'Nigar Həsənova') && !(await hasText(page, 'Söhbət seçin'));
  await clickText(page, 'aside button', 'Nigar'); await sleep(500);
  const msgsVisible = await hasText(page, 'Salam, kitab hələ satılıbmı?');
  await page.type('input[aria-label="Mesaj"]', 'Test mesajı 123'); await page.click('form button.btn-primary'); await sleep(500);
  const sent = await hasText(page, 'Test mesajı 123');
  await shot(page, 'chat-open-mobile');
  await page.click('button[aria-label="Söhbətlərə qayıt"]'); await sleep(300);
  const back = await page.evaluate(() => document.querySelector('aside').offsetParent !== null);
  rec('çat (mobil): siyahı → söhbət → mesaj göndərmə → geri', listVisible && msgsVisible && sent && back, `list=${listVisible} msgs=${msgsVisible} sent=${sent} back=${back}`);
  await page.close();
}
{ // kabinet
  const page = await open('/profile', { w: 390, h: 844, auth: true });
  await clickText(page, '[role=tab]', 'Sınaq nəticələrim'); await sleep(200);
  rec('kabinet: sınaq nəticələri tarixçəsi göstərilir (80% / 40%)', await hasText(page, '80%') && await hasText(page, '40%'));
  await clickText(page, '[role=tab]', 'Profil'); await sleep(200);
  await clickText(page, 'button', 'Hesabımı sil'); await sleep(200);
  const dlg = await page.$('[role=dialog]');
  const disabled0 = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Hesabı sil')).disabled);
  await page.type('#del-confirm', 'SİL'); await sleep(100);
  const disabled1 = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.includes('Hesabı sil')).disabled);
  await shot(page, 'delete-modal-mobile');
  await page.keyboard.press('Escape'); await sleep(200);
  rec('kabinet: hesab silmə modalı — təsdiq sözü olmadan düymə söndürülüb, Esc bağlayır', !!dlg && disabled0 === true && disabled1 === false && !(await page.$('[role=dialog]')), `d0=${disabled0} d1=${disabled1}`);
  await page.close();
}
{ // desktop profil menyusu + oxunmamış sayğac
  const page = await open('/', { w: 1280, h: 800, auth: true });
  const badge = await page.evaluate(() => !!document.querySelector('nav[aria-label="Əsas menyu"] a[href="/chat"] span'));
  await page.click('button[aria-haspopup="menu"]'); await sleep(150);
  const menu = await hasText(page, 'Çıxış') && await hasText(page, 'Mesajlar (2)');
  await shot(page, 'profile-menu-desktop');
  rec('desktop: oxunmamış mesaj nişanı və profil menyusu işləyir', badge && menu, `badge=${badge} menu=${menu}`);
  await page.close();
}

}
if (STAGE === 'axe') {
// ---------- 4) axe-core (əlçatanlıq, rəng kontrastı daxil)
for (const [p, auth] of [['/', false], ['/auth', false], ['/books', true], ['/pdfs', true], ['/quizzes', false], ['/legal/privacy', false], ['/profile', true], ['/chat?c=c1', true]]) {
  for (const w of [390, 1280]) {
    const page = await open(p, { w, h: 844, auth });
    await page.evaluate(axeSrc);
    const r = await page.evaluate(async () => { const x = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }); return x.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ').slice(0, 80) })); });
    axeOut.push({ path: p, w, violations: r });
    await page.close();
  }
}
}
await browser.close();
fs.writeFileSync(`./res_${STAGE}.json`, JSON.stringify({ results, consoleIssues, axeOut }, null, 1));
console.log('DONE');
