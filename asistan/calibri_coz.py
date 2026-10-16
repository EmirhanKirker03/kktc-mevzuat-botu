import json,sys,collections,random
sys.path.insert(0,'.'); import onar
toks=json.load(open(sys.argv[1]))[:1500]
toks=[w.replace('LJ','y').replace('nj','z') for w in toks]
alf=[ch for ch,n in collections.Counter(ch for w in toks for ch in w).most_common() if n>=12]
ilk={'Ă':'a','ď':'b','Đ':'c','Ě':'d','Ğ':'e','Ĩ':'f','Ő':'g','Ś':'h','ŝ':'i','Ŭ':'k','ů':'l','ŵ':'m','Ŷ':'n','Ž':'o','Ɖ':'p','ƌ':'r','Ɛ':'s','ƚ':'t','Ƶ':'u','ǀ':'v','Ŧ':'ı','Ɣ':'ş','ƺ':'ü','Œ':'ğ','ĕ':'ç','Ƃ':'ö','Ϭ':'0','ϭ':'1','Ϯ':'2','ϯ':'3','ϰ':'4','ϱ':'5','ϲ':'6','ϳ':'7','ϴ':'8','ϵ':'9','͘':'.','͕':',','ͬ':'/','͛':'’','Ϳ':')','͗':':','͞':'“','͟':'”'}
M={ch:ilk.get(ch,ch) for ch in alf}
aday=list('abcçdefgğhıijklmnoöprsştuüvyz0123456789.,;:/()’“”-')+['']
def dec(w): return ''.join(M.get(c,c) for c in w)
def skor(): return sum(onar.puan(dec(w)) for w in toks)/len(toks)
s0=skor(); print('başlangıç',round(s0,3))
for tur in range(2):
    for ch in alf:
        if ch in ' ': continue
        en,ens=M[ch],None
        ilgili=[w for w in toks if ch in w][:300]
        if not ilgili: continue
        for a in aday:
            M[ch]=a; s=sum(onar.puan(dec(w)) for w in ilgili)
            if ens is None or s>ens: en,ens=a,s
        M[ch]=en
    print('tur',tur,round(skor(),3))
json.dump(M,open('onar_calibri.json','w'),ensure_ascii=False)
print({k:v for k,v in M.items() if ilk.get(k,k)!=v})
random.seed(4); print([dec(w) for w in random.sample(toks,25)])
