# Αντικαθιστά ολόκληρες γραμμές-ερωτήσεις σε αρχείο γεννήτριας. fixes: {παλιά ερώτηση: (νέα ερώτηση ή None, σωστή, λ1, λ2, λ3)}
import json,re,sys
def apply(path, fixes):
    lines=open(path,encoding='utf8').read().split('\n'); used=set()
    for i,l in enumerate(lines):
        m=re.match(r'^(\s*)\("((?:[^"\\]|\\.)*)",',l)
        if m and m.group(2) in fixes:
            q=m.group(2); nq,*rest=fixes[q]; nq=nq or q
            assert len(rest)==4 and len(set(rest))==4,(q,rest)
            lines[i]=m.group(1)+"("+", ".join(json.dumps(x,ensure_ascii=False) for x in [nq,*rest])+"),"
            used.add(q)
    miss=set(fixes)-used
    assert not miss, miss
    open(path,'w',encoding='utf8').write('\n'.join(lines))
    print(path,len(used),'διορθώσεις')
