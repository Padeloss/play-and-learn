import json,glob,os,re,sys
BAD=re.compile(r"(τίποτα|κανένας|κανένα\b|κανείς|σούσι|πίτσα|τηλέφωνο|αστέρια|ταμπλέτ|υπολογιστ|κινητ|σοκολάτ|παγωτ|ποτέ|γάτ|σκύλ|μόνο τη νύχτα|δεν ξέρω|όλα τα παραπάνω|κανένα από)",re.I)
out=[]
for f in sorted(glob.glob('**/*.json',recursive=True)):
    if f.endswith(('meta.json','grades.json')): continue
    qs=json.load(open(f,encoding='utf8'))
    for i,q in enumerate(qs):
        ch=[re.sub(r'^\d+\.\s*','',c) for c in q['choices']]
        a=int(q['answer'])-1; r=ch[a]
        others=[c for j,c in enumerate(ch) if j!=a]
        flags=[]
        if len(r)>1.6*max(len(c) for c in others) and len(r)-max(len(c) for c in others)>8: flags.append('LONGEST')
        for c in others:
            if BAD.search(c): flags.append('BAD:'+c)
        if flags: out.append(f"{f}#{i} | {q['question']} | R={r} | {ch} | {flags}")
print(len(out))
open('/tmp/audit.txt','w').write("\n".join(out))
