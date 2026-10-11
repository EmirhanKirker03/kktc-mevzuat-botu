// Bozuk / kötü niyetli yapay zekâ cevaplarına karşı dayanıklılık: XSS yok, sayfa hatası yok, düğmeler kilitlenmiyor, kullanıcıya anlaşılır mesaj
const {chromium}=require('/opt/npm-tools/node_modules/playwright'); const fs=require('fs'); const MOD=__dirname+'/mock_mod.txt';
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const p=await (await b.newContext()).newPage(); const hata=[];
p.on('pageerror',e=>hata.push(e.message)); p.on('dialog',d=>{ hata.push('dialog '+d.message()); d.dismiss(); });
await p.goto('http://localhost:3100/giris'); await p.fill('input[type=email]','yonetici@test.local'); await p.fill('input[type=password]','yonetici12345'); await p.click('button[type=submit]'); await p.waitForURL('http://localhost:3100/');
const sonuc={};
for(const mod of ['metin','html','eksik','uzun','hata','bos']){
  fs.writeFileSync(MOD,mod); const r={};
  await p.click('#tab-ask'); await p.evaluate(()=>{ document.querySelector('#answer').innerHTML='<i id="eski">ESKİ CEVAP</i>'; document.querySelector('#state').textContent=''; window.__bitti=false; });
  await p.fill('#q','Kiracı kirayı ödemezse tahliye istenebilir mi?'); await p.click('#ask');
  await p.waitForFunction(()=>{ const st=document.querySelector('#state').textContent.trim(); return !document.querySelector('#ask').disabled && document.querySelector('#stop').hidden && ((st && !/aranıyor|okunuyor|yükleniyor/i.test(st)) || !document.querySelector('#eski')); },null,{timeout:30000}); await p.waitForTimeout(300);
  r.eskiKaldi=await p.evaluate(()=>!!document.querySelector('#eski'));
  r.sor=(await p.textContent('#state')).trim()||(await p.textContent('#answer')).trim().slice(0,90);
  await p.click('#tab-taslak'); await p.waitForTimeout(300); await p.fill('#tolay','Kiracı kirayı üç aydır ödemiyor, tahliye ve birikmiş kira talep ediyoruz.'); await p.click('#thazirla');
  await p.waitForFunction(()=>!document.querySelector('#thazirla').disabled,null,{timeout:30000}); await p.waitForTimeout(300);
  r.taslak=(await p.textContent('#tstate')).trim()||(await p.textContent('#tcikti')).trim().slice(0,90);
  await p.click('#tab-file'); await p.click('#risk'); await p.waitForFunction(()=>!document.querySelector('#risk').disabled,null,{timeout:30000}); await p.waitForTimeout(300);
  r.risk=(await p.textContent('#sstate')).trim()||(await p.textContent('#sumout')).trim().slice(0,90);
  r.xss=await p.evaluate(()=>window.__xss||0); sonuc[mod]=r;
}
fs.writeFileSync(MOD,''); console.log(JSON.stringify(sonuc,null,1)); console.log('sayfa hataları:',hata); await b.close(); })();
