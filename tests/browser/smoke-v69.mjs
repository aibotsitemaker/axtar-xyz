import assert from 'node:assert/strict';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const APP_PORT=process.env.APP_PORT||3071;const MOCK_PORT=process.env.MOCK_PORT||54322;const BASE=`http://localhost:${APP_PORT}`;
const b64=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:'u1',role:'authenticated',exp:4102444800,aud:'authenticated'})}.sig`;
const session=JSON.stringify({access_token:token,refresh_token:'r',expires_in:3600,expires_at:4102444800,token_type:'bearer',user:{id:'u1',aud:'authenticated',role:'authenticated',email:'ali@test.az',user_metadata:{full_name:'Əli Əliyev'},app_metadata:{}}});
const errors=[];
const browser=await puppeteer.launch({args:[...chromium.args,'--no-sandbox'],executablePath:process.env.BROWSER_EXECUTABLE_PATH||await chromium.executablePath(),headless:'shell'});
async function open(path,{width=1280,height=860,auth=false}={}){
 const page=await browser.newPage();await page.setViewport({width,height,deviceScaleFactor:1,isMobile:width<500,hasTouch:width<500});
 if(auth)await page.evaluateOnNewDocument((value)=>localStorage.setItem('sb-mock-auth-token',value),session);
 await page.setRequestInterception(true);
 page.on('request',(request)=>{
  if(request.url()===`${BASE}/api/feed-media`)return request.respond({status:200,contentType:'application/json',body:JSON.stringify({path:'00000000-0000-0000-0000-000000000001/browser-upload.png'})});
  if(request.url().startsWith('https://mock.supabase.co/'))return request.continue({url:request.url().replace('https://mock.supabase.co',`http://localhost:${MOCK_PORT}`)});
  return request.continue();
 });
 page.on('pageerror',e=>errors.push(`${path}: ${e.message}`));
 await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:30000});
 return page;
}
try{
 const desktop=await open('/',{width:1280});
 await desktop.waitForFunction(()=>document.body.innerText.includes('Mətnli post')&&document.body.innerText.includes('Şəkilli post'),{timeout:20000});
 assert.equal(await desktop.evaluate(()=>document.body.innerText.includes('Gözlənilməz xəta baş verdi')),false,'Feed desktop rendered app error');
 assert.equal(await desktop.evaluate(()=>document.body.innerText.includes('Səhv media ilə post')),true,'Malformed media post should remain visible as text');
 assert.equal(await desktop.evaluate(()=>document.body.innerText.includes('şəkli hazırda əlçatan deyil')),true,'Malformed media should show isolated placeholder');
 assert.equal(await desktop.evaluate(()=>document.querySelectorAll('article.feed-post').length),3,'Text, image, and broken-image posts should all render');
 const desktopOverflow=await desktop.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert.ok(desktopOverflow<=0,`Desktop feed overflows by ${desktopOverflow}px`);
 await desktop.close();

 const mobile=await open('/',{width:390,height:844});
 await mobile.waitForFunction(()=>document.body.innerText.includes('Mətnli post')&&document.body.innerText.includes('Şəkilli post'),{timeout:20000});
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=0,'Mobile feed should not overflow');
 assert.equal(await mobile.evaluate(()=>document.body.innerText.includes('Gözlənilməz xəta baş verdi')),false,'Mobile Feed should not render app error');
 await mobile.close();

 const signed=await open('/',{width:390,height:844,auth:true});
 await signed.waitForFunction(()=>document.body.innerText.includes('Şəkilli post'),{timeout:20000});
 await signed.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Şəkil')?.click());
 await signed.waitForSelector('input[aria-label="Feed şəkilləri seç"]');
 await signed.$eval('input[aria-label="Feed şəkilləri seç"]',input=>{
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const transfer=new DataTransfer();transfer.items.add(new File([bytes],'tiny.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await signed.waitForSelector('img[alt="Seçilmiş şəkil 1"]',{timeout:5000});
 await signed.click('#feed-body');await signed.type('#feed-body','Test şəkilli post: yükləmə və Feed qorunması');
 await signed.click('form.feed-composer button.btn-primary');
 await signed.waitForFunction(()=>document.body.innerText.includes('Test şəkilli post: yükləmə və Feed qorunması'),{timeout:20000});
 assert.equal(await signed.evaluate(()=>document.body.innerText.includes('Gözlənilməz xəta baş verdi')),false,'Posting an image must not crash the homepage');
 await signed.close();

 const profile=await open('/u/00000000-0000-0000-0000-000000000002',{width:390,height:844,auth:true});
 await profile.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Mesaj yaz')),{timeout:20000});
 await profile.click('button.btn-primary.btn-sm');
 await profile.waitForFunction(()=>location.pathname==='/chat'&&location.search.includes('c='),{timeout:10000});
 await profile.close();

 const rooms=await open('/rooms',{width:390,height:844,auth:true});
 await rooms.waitForFunction(()=>document.body.innerText.includes('Müzakirə otaqları')&&document.body.innerText.includes('Riyaziyyat otağı'),{timeout:20000});
 assert.equal(await rooms.evaluate(()=>document.body.innerText.includes('Çat')),false,'Room UI should not use the retired label');
 await rooms.close();
 assert.deepEqual(errors,[],'No browser render errors across tested flows');
 console.log('PASS  Chromium desktop/mobile Feed: text, image, damaged media fallback, image publishing, profile message start and discussion rooms');
}finally{await browser.close();}
