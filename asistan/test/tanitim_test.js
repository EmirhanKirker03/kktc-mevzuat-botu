// İlk açılış tanıtımı ve sadeleştirilmiş ana ekran testi (gerçek kullanıcı gibi: webdriver bayrağı gizlenir)
const {chromium}=require('playwright'); const D=process.argv[2]||'/tmp';
(async()=>{const b=await chromium.launch();let g=0,k=0;const ok=(a,c)=>{console.log((c?'GEÇTİ ':'KALDI ')+a);c?g++:k++;};
for(const [ad,vp] of [['masa',{width:1366,height:800}],['tel',{width:390,height:844}]]){
  const p=await b.newPage({viewport:vp}); await p.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
  await p.goto('http://127.0.0.1:8811/kira_asistani.html'); await p.waitForTimeout(1200);
  ok(ad+': tanıtım ilk açılışta görünüyor', await p.isVisible('#tanitim'));
  await p.screenshot({path:D+'/tanit1_'+ad+'.png'});
  ok(ad+': 1/3', (await p.textContent('#tanit-adim'))==='1 / 3');
  await p.click('#tanit-ileri'); await p.click('#tanit-ileri'); ok(ad+': 3/3 ve Başla', (await p.textContent('#tanit-ileri'))==='Başla');
  await p.screenshot({path:D+'/tanit3_'+ad+'.png'});
  await p.click('#tanit-ileri'); ok(ad+': kapandı', !(await p.isVisible('#tanitim')));
  await p.reload(); await p.waitForTimeout(1000); ok(ad+': ikinci açılışta çıkmıyor', !(await p.isVisible('#tanitim')));
  await p.click(ad==='tel'?'#tanitac2':'#tanitac'); ok(ad+': "Nasıl kullanılır" ile yeniden açılıyor', await p.isVisible('#tanitim'));
  await p.keyboard.press('Escape'); ok(ad+': Esc ile kapanıyor', !(await p.isVisible('#tanitim')));
  ok(ad+': tek görünür düğme (Ayrıntılı araştır yok)', !(await p.isVisible('#derinbtn')) && await p.isVisible('#ask'));
  const txt=await p.evaluate(()=>document.body.innerText);
  ok(ad+': "prototip" yazmıyor', !/prototip/i.test(txt));
  if(ad==='masa') ok('DİĞER doğru büyük harf', txt.includes('DİĞER') && !txt.includes('DIĞER'));
  if(ad==='tel'){ const n=await p.evaluate(()=>[...document.querySelectorAll('#examples .chip')].filter(c=>c.offsetParent&&c.getBoundingClientRect().right<=window.innerWidth+1).length); ok('telefonda 4 örnek soru tam görünüyor ('+n+')', n===4); }
  await p.screenshot({path:D+'/ana_'+ad+'.png'}); await p.close();}
console.log('\nSONUÇ: '+g+' geçti, '+k+' kaldı'); await b.close();})();
