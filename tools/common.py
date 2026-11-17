# Κοινός βοηθός για τις γεννήτριες κεφαλαίων.
# Χρήση σε κάθε αρχείο: from common import Course; c = Course("Γ΄ Γυμνασίου/Μαθηματικά", "Γ΄ Γυμνασίου", "πηγή");
# c.ch(id, num, unit, title, [(ερώτηση, σωστή, λάθος1, λάθος2, λάθος3), ...]); c.write(ROOT)
import json, os, random, sys, glob

class Course:
    def __init__(self, path, grade, source):
        self.path, self.grade, self.source, self.CH = path, grade, source, []
    def ch(self, cid, num, unit, title, qs):
        self.CH.append((cid, num, unit, title, qs))
    def write(self, root="backend/lessons"):
        out_dir = os.path.join(root, self.path)
        os.makedirs(os.path.join(out_dir, "chapters"), exist_ok=True)
        seen, total, meta = set(), 0, []
        for cid, num, unit, title, qs in self.CH:
            rng = random.Random("c-" + self.path + cid)
            out = []
            for question, right, *wrong in qs:
                assert len(wrong) == 3 and len(set([right] + wrong)) == 4, (self.path, question)
                assert question not in seen, (self.path, question)
                seen.add(question)
                choices = [right] + wrong
                rng.shuffle(choices)
                out.append({"question": question,
                            "choices": [f"{i+1}. {c}" for i, c in enumerate(choices)],
                            "answer": str(choices.index(right) + 1)})
            total += len(out)
            with open(os.path.join(out_dir, "chapters", f"{cid}.json"), "w", encoding="utf8") as f:
                json.dump(out, f, ensure_ascii=False, indent=2); f.write("\n")
            meta.append({"id": cid, "num": num, "title": title, "unit": unit})
        # κρατάμε τυχόν επιπλέον κλειδιά του παλιού meta.json (π.χ. keyName)
        mp = os.path.join(out_dir, "meta.json")
        old = {}
        if os.path.exists(mp):
            old = json.load(open(mp, encoding="utf8"))
        old.update({"grade": self.grade, "source": self.source, "chapters": meta})
        with open(mp, "w", encoding="utf8") as f:
            json.dump(old, f, ensure_ascii=False, indent=2); f.write("\n")
        for d in ("easy", "medium", "hard"):
            p = os.path.join(out_dir, d + ".json")
            if os.path.exists(p):
                os.remove(p)
        print(f"{self.path}: {len(self.CH)} κεφάλαια, {total} ερωτήσεις")
