// Tarayıcıda (basimevi.gov.ct.tr sekmesinde) dış kütüphane olmadan PDF metin katmanını çıkarır.
// 23.11.2026: CDN'den pdf.js/tesseract.js yüklemek izin denetiminden geçmediği için yazıldı.
// Kullanım (javascript_tool ile, sırayla): bu dosyanın içeriğini çalıştır →
//   const b=new Uint8Array(await (await fetch(url)).arrayBuffer()); const t=await __T.all(b);
// Çıktı: sayfalar "[SAYFA n]\n" ile; aynı satırdaki öğeler bitişik yazılabilir ("EK IVSayı"), satır sonları y konumundan.
// Görüntü (taranmış) sayfalar boş çıkar: bunlar için yazı tanıma gerekir (bu betik yapmaz).
// Doğrulama: 225 sayısında 4 hedefin 4'ü eşleşti; sha256 ile buluta aktarım birebir.
window.__P = (function(){
const L1=b=>{let s='';for(let i=0;i<b.length;i+=65536)s+=String.fromCharCode.apply(null,b.subarray(i,i+65536));return s;};
async function inflate(u8){try{const ds=new DecompressionStream('deflate');return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());}catch(e){
 try{const ds=new DecompressionStream('deflate');const wr=ds.writable.getWriter();wr.write(u8).catch(()=>{});wr.close().catch(()=>{});const rd=ds.readable.getReader();const parts=[];let n=0;while(true){let r;try{r=await rd.read();}catch(e2){break;}if(r.done)break;parts.push(r.value);n+=r.value.length;}const o=new Uint8Array(n);let p=0;for(const x of parts){o.set(x,p);p+=x.length;}return o;}catch(e3){return null;}}}
function parseObj(s,i){
 const ws=()=>{while(i<s.length){const c=s[i];if(c===' '||c==='\n'||c==='\r'||c==='\t'||c==='\f'||c==='\0')i++;else if(c==='%'){while(i<s.length&&s[i]!=='\n'&&s[i]!=='\r')i++;}else break;}};
 function val(){ws();const c=s[i];
  if(c==='<'&&s[i+1]==='<'){i+=2;const d={};while(true){ws();if(s[i]==='>'&&s[i+1]==='>'){i+=2;break;}if(s[i]!=='/'){i++;continue;}const k=name();d[k]=val();}return d;}
  if(c==='<'){i++;let h='';while(s[i]!=='>'){h+=s[i];i++;}i++;h=h.replace(/\s/g,'');if(h.length%2)h+='0';let r='';for(let k=0;k<h.length;k+=2)r+=String.fromCharCode(parseInt(h.substr(k,2),16));return {str:r};}
  if(c==='['){i++;const a=[];while(true){ws();if(s[i]===']'){i++;break;}a.push(val());}return a;}
  if(c==='('){return {str:lit()};}
  if(c==='/'){return {name:name()};}
  let t='';while(i<s.length&&!/[\s\/\[\]<>()%]/.test(s[i])){t+=s[i];i++;}
  if(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)){const save=i;ws();let m=/^(\d+)\s+R(?![A-Za-z])/.exec(s.substr(i,20));if(/^\d+$/.test(t)&&m){i+=m[0].length;return {ref:+t};}i=save;return +t;}
  if(t==='true')return true;if(t==='false')return false;if(t==='null')return null;return {op:t};}
 function name(){i++;let t='';while(i<s.length&&!/[\s\/\[\]<>()%{}]/.test(s[i])){t+=s[i];i++;}return t.replace(/#([0-9a-fA-F]{2})/g,(m,h)=>String.fromCharCode(parseInt(h,16)));}
 function lit(){i++;let d=1,r='';while(i<s.length){let c=s[i++];if(c==='\\'){c=s[i++];if(c==='n')r+='\n';else if(c==='r')r+='\r';else if(c==='t')r+='\t';else if(c==='b')r+='\b';else if(c==='f')r+='\f';else if(c==='\r'){if(s[i]==='\n')i++;}else if(c==='\n'){}else if(/[0-7]/.test(c)){let o=c;for(let k=0;k<2&&/[0-7]/.test(s[i]);k++)o+=s[i++];r+=String.fromCharCode(parseInt(o,8)&255);}else r+=c;}else if(c==='('){d++;r+=c;}else if(c===')'){d--;if(d===0)break;r+=c;}else r+=c;}return r;}
 const v=val();return [v,i];}
async function load(bytes){
 const S=L1(bytes);const objs={};const re=/(\d+)\s+(\d+)\s+obj\b/g;let m;
 while((m=re.exec(S))){const num=+m[1];let [v,j]=parseObj(S,m.index+m[0].length);let k=j;while(/\s/.test(S[k]))k++;let o={v};
  if(S.substr(k,6)==='stream'){k+=6;if(S[k]==='\r')k++;if(S[k]==='\n')k++;let len=v&&typeof v.Length==='number'?v.Length:-1;let end;if(len>=0&&/^\s*endstream/.test(S.substr(k+len,20)))end=k+len;else end=S.indexOf('endstream',k);o.raw=bytes.subarray(k,end);re.lastIndex=end;}
  objs[num]=o;}
 for(const o of Object.values(objs)){if(o.raw&&o.v&&o.v.Length&&o.v.Length.ref!=null){const L=objs[o.v.Length.ref];if(L&&typeof L.v==='number')o.raw=o.raw.subarray(0,Math.min(o.raw.length,L.v));}}
 async function data(o){if(o.data!==undefined)return o.data;let f=o.v.Filter;if(f&&f.ref!=null)f=objs[f.ref].v;const fl=Array.isArray(f)?f.map(x=>x.name):f?[f.name]:[];let d=o.raw;for(const x of fl){if(x==='FlateDecode')d=d&&await inflate(d);else {d=null;break;}}
  if(d&&o.v.DecodeParms&&o.v.DecodeParms.Predictor>=10){d=null;} o.data=d;return d;}
 for(const [n,o] of Object.entries(objs)){if(o.v&&o.v.Type&&o.v.Type.name==='ObjStm'){const d=await data(o);if(!d)continue;const s=L1(d);const N=o.v.N,F=o.v.First;const hdr=s.slice(0,F).trim().split(/\s+/).map(Number);for(let q=0;q<N;q++){const on=hdr[2*q],off=hdr[2*q+1];if(objs[on]&&!objs[on].fromStm&&objs[on].v!==undefined&&!(objs[on].raw))continue;const [v]=parseObj(s,F+off);objs[on]={v,fromStm:true};}}}
 return {objs,data,R:x=>{while(x&&x.ref!=null)x=objs[x.ref]?objs[x.ref].v:null;return x;}};}
return {load,parseObj,L1,inflate};})();

window.__T=(function(){
const W={0x80:0x20AC,0x82:0x201A,0x83:0x192,0x84:0x201E,0x85:0x2026,0x86:0x2020,0x87:0x2021,0x88:0x2C6,0x89:0x2030,0x8A:0x160,0x8B:0x2039,0x8C:0x152,0x8E:0x17D,0x91:0x2018,0x92:0x2019,0x93:0x201C,0x94:0x201D,0x95:0x2022,0x96:0x2013,0x97:0x2014,0x98:0x2DC,0x99:0x2122,0x9A:0x161,0x9B:0x203A,0x9C:0x153,0x9E:0x17E,0x9F:0x178};
const GN={space:' ',gbreve:'ğ',Gbreve:'Ğ',scedilla:'ş',Scedilla:'Ş',dotlessi:'ı',Idotaccent:'İ',Idot:'İ',ccedilla:'ç',Ccedilla:'Ç',odieresis:'ö',Odieresis:'Ö',udieresis:'ü',Udieresis:'Ü',quoteright:'’',quoteleft:'‘',quotedblleft:'“',quotedblright:'”',endash:'–',emdash:'—',hyphen:'-',period:'.',comma:',',colon:':',semicolon:';',parenleft:'(',parenright:')',slash:'/',zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',percent:'%',quotesingle:"'",quotedbl:'"',acircumflex:'â',Acircumflex:'Â',icircumflex:'î',ucircumflex:'û',bullet:'•',ellipsis:'…',ampersand:'&',plus:'+',equal:'=',underscore:'_',bracketleft:'[',bracketright:']',question:'?',exclam:'!',asterisk:'*',numbersign:'#',degree:'°',section:'§'};
function cmap(s){const m=new Map();let cl=1;const cs=/begincodespacerange([\s\S]*?)endcodespacerange/.exec(s);if(cs){const h=/<([0-9a-fA-F]+)>/.exec(cs[1]);if(h)cl=h[1].length/2;}
 const hex2u=h=>{let r='';for(let k=0;k+4<=h.length;k+=4)r+=String.fromCharCode(parseInt(h.substr(k,4),16));if(h.length===2)r=String.fromCharCode(parseInt(h,16));return r;};
 for(const b of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))for(const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g))m.set(parseInt(x[1],16),hex2u(x[2]));
 for(const b of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)){for(const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]*)>|\[([^\]]*)\])/g)){const lo=parseInt(x[1],16),hi=parseInt(x[2],16);if(x[4]!==undefined){const base=x[4];const last=parseInt(base.slice(-4)||base,16);for(let c=lo;c<=hi&&c-lo<65536;c++){const v=hex2u(base.slice(0,-4))+String.fromCharCode(last+(c-lo));m.set(c,base.length<=2?String.fromCharCode(parseInt(base,16)+(c-lo)):v);}}else{const arr=[...x[5].matchAll(/<([0-9a-fA-F]*)>/g)].map(y=>hex2u(y[1]));arr.forEach((v,k)=>m.set(lo+k,v));}}}
 return {m,cl};}
async function fontInfo(D,f,cache){if(cache.has(f))return cache.get(f);const fo=D.R(f)||{};let info={cl:1,map:null,enc:null,diff:{}};
 if(fo.Subtype&&fo.Subtype.name==='Type0')info.cl=2;
 if(fo.ToUnicode){const o=D.objs[fo.ToUnicode.ref];if(o){const d=await D.data(o);if(d){const c=cmap(__P.L1(d));info.map=c.m;if(fo.Subtype&&fo.Subtype.name==='Type0')info.cl=c.cl||2;}}}
 const e=D.R(fo.Encoding);if(e&&e.Differences){let c=0;for(const x of e.Differences){if(typeof x==='number')c=x;else if(x&&x.name){info.diff[c]=x.name;c++;}}}
 cache.set(f,info);return info;}
function dec(info,str){let r='';const cl=info.cl;for(let k=0;k+cl<=str.length;k+=cl){let c=0;for(let q=0;q<cl;q++)c=c*256+str.charCodeAt(k+q);let u;
 if(info.map&&info.map.has(c))u=info.map.get(c);else if(cl===1&&info.diff[c]){const n=info.diff[c];u=GN[n]||(n.length===1?n:(/^uni([0-9A-F]{4})$/.exec(n)?String.fromCharCode(parseInt(n.slice(3),16)):''));}else if(cl===1)u=String.fromCharCode(W[c]||c);else u='';r+=u;}return r;}
const mul=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3],a[4]*b[0]+a[5]*b[2]+b[4],a[4]*b[1]+a[5]*b[3]+b[5]];
function toks(s){const out=[];let i=0;while(i<s.length){const c=s[i];if(/\s/.test(c)){i++;continue;}if(c==='%'){while(i<s.length&&s[i]!=='\n'&&s[i]!=='\r')i++;continue;}
 if(c==='('||c==='['||c==='/'||(c==='<')||/[0-9+\-.]/.test(c)){if(c==='<'&&s[i+1]==='<'){const [v,j]=__P.parseObj(s,i);out.push({v});i=j;continue;}const [v,j]=__P.parseObj(s,i);i=j;if(v&&v.ref!=null){out.push({v:+(String(v.ref))});out.push({v:0});out.push({op:'R'});continue;}out.push(v&&v.op?{op:v.op}:{v});continue;}
 let t='';while(i<s.length&&!/[\s\/\[\]<>()%]/.test(s[i])){t+=s[i];i++;}if(!t){i++;continue;}
 if(t==='BI'){const e=s.indexOf('EI',i);i=e<0?s.length:e+2;continue;}out.push({op:t});}return out;}
async function page(D,pg){const cache=new Map();const items=[];
 async function run(content,res,ctm0){const fontsD=D.R(res&&res.Font)||{};const xo=D.R(res&&res.XObject)||{};let ctm=ctm0.slice(),st=[],tm=[1,0,0,1,0,0],tlm=[1,0,0,1,0,0],font=null,fs=1,lead=0,ops=[],th=1;
  const T=toks(content);
  const show=async(str)=>{if(!font)return;const txt=dec(font,str);const m=mul(tm,ctm);items.push({s:txt,x:m[4],y:m[5],fs:Math.abs(fs*Math.hypot(m[2],m[3]))||fs});tm=mul([1,0,0,1,txt.length*fs*0.5*th,0],tm);};
  for(const t of T){if(!t.op){ops.push(t.v);continue;}const o=t.op,a=ops;ops=[];
   switch(o){case 'q':st.push(ctm.slice());break;case 'Q':ctm=st.pop()||ctm;break;case 'cm':ctm=mul(a.slice(-6),ctm);break;
   case 'BT':tm=[1,0,0,1,0,0];tlm=tm.slice();break;case 'Tf':{const fn=a[a.length-2]&&a[a.length-2].name;fs=a[a.length-1];font=fontsD[fn]?await fontInfo(D,fontsD[fn],cache):null;break;}
   case 'Td':tlm=mul([1,0,0,1,a[0],a[1]],tlm);tm=tlm.slice();break;case 'TD':lead=-a[1];tlm=mul([1,0,0,1,a[0],a[1]],tlm);tm=tlm.slice();break;
   case 'Tm':tlm=a.slice(-6);tm=tlm.slice();break;case 'T*':tlm=mul([1,0,0,1,0,-lead],tlm);tm=tlm.slice();break;case 'TL':lead=a[0];break;case 'Tz':th=a[0]/100;break;
   case 'Tj':await show(a[0]&&a[0].str||'');break;case "'":tlm=mul([1,0,0,1,0,-lead],tlm);tm=tlm.slice();await show(a[0]&&a[0].str||'');break;case '"':tlm=mul([1,0,0,1,0,-lead],tlm);tm=tlm.slice();await show(a[2]&&a[2].str||'');break;
   case 'TJ':{const arr=a[0]||[];let buf='';for(const e of arr){if(e&&e.str!==undefined)buf+=e.str;else if(typeof e==='number'&&e<-200&&font){await show(buf);buf='';items.push({s:' ',x:0,y:items.length?items[items.length-1].y:0,fs,sp:1});}}await show(buf);break;}
   case 'Do':{const n=a[0]&&a[0].name;const r=xo[n];const ob=r&&r.ref!=null?D.objs[r.ref]:null;if(ob&&ob.v.Subtype&&ob.v.Subtype.name==='Form'){const d=await D.data(ob);if(d){const fm=ob.v.Matrix||[1,0,0,1,0,0];await run(__P.L1(d),D.R(ob.v.Resources)||res,mul(fm,ctm));}}break;}
   }}}
 let res=D.R(pg.Resources),p=pg;while(!res&&p.Parent){p=D.R(p.Parent);res=D.R(p.Resources);}
 let c=pg.Contents;let parts=[];const cc=D.R(c);if(Array.isArray(cc))parts=cc;else parts=[c];let s='';for(const x of parts){const o=x&&x.ref!=null?D.objs[x.ref]:null;if(!o)continue;const d=await D.data(o);if(d)s+=__P.L1(d)+'\n';}
 await run(s,res,[1,0,0,1,0,0]);
 let out='',py=null,pfs=0;for(const it of items){if(it.sp){if(!out.endsWith(' ')&&!out.endsWith('\n'))out+=' ';continue;}if(!it.s)continue;if(py!==null&&Math.abs(it.y-py)>Math.max(2,0.5*Math.min(pfs||it.fs,it.fs)))out+='\n';out+=it.s;py=it.y;pfs=it.fs;}
 return out;}
async function all(bytes){const D=await __P.load(bytes);const cat=Object.values(D.objs).find(o=>o.v&&o.v.Type&&o.v.Type.name==='Catalog');const pages=[];
 const walk=n=>{n=D.R(n);if(!n)return;if(n.Type&&n.Type.name==='Pages'||n.Kids){for(const k of n.Kids||[])walk(k);}else pages.push(n);};walk(cat.v.Pages);
 const txt=[];for(let k=0;k<pages.length;k++){let t='';try{t=await page(D,pages[k]);}catch(e){t='!!HATA '+e;}txt.push('[SAYFA '+(k+1)+']\n'+t);}return txt.join('\n');}
return {all};})();
// Aktarım: gzip + base64 (CompressionStream('gzip')); bulutta `base64 -d | gunzip`, sha256 ile karşılaştır (https sayfada crypto.subtle).
