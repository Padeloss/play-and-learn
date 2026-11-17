# Ομαδοποίηση των υπαρχουσών ερωτήσεων (easy+medium+hard, με αυτή τη σειρά) σε κεφάλαια.
# Κάθε κεφάλαιο παίρνει τις ερωτήσεις των δεικτών που του δίνονται (0 = πρώτη ερώτηση του easy.json).
# Οι ερωτήσεις μένουν αυτούσιες. Αν τα easy/medium/hard έχουν ήδη διαγραφεί, διαβάζονται από το git (HEAD).
import json, os, subprocess

def load_old(path, root):
    qs = []
    for d in ("easy", "medium", "hard"):
        p = os.path.join(root, path, d + ".json")
        if os.path.exists(p):
            qs += json.load(open(p, encoding="utf8"))
        else:
            out = subprocess.run(["git", "show", f"HEAD:{root}/{path}/{d}.json"], capture_output=True, text=True, check=True).stdout
            qs += json.loads(out)
    return qs

def classify(path, grade, source, chapters, root="backend/lessons"):
    qs = load_old(path, root)
    used = [i for ch in chapters for i in ch[4]]
    assert sorted(used) == list(range(len(qs))), (path, "λείπουν/διπλές:", sorted(set(range(len(qs))) - set(used)), len(used), len(qs))
    out_dir = os.path.join(root, path)
    os.makedirs(os.path.join(out_dir, "chapters"), exist_ok=True)
    meta = []
    for cid, num, unit, title, idx in chapters:
        with open(os.path.join(out_dir, "chapters", cid + ".json"), "w", encoding="utf8") as f:
            json.dump([qs[i] for i in idx], f, ensure_ascii=False, indent=2); f.write("\n")
        meta.append({"id": cid, "num": num, "title": title, "unit": unit})
    mp = os.path.join(out_dir, "meta.json")
    old = json.load(open(mp, encoding="utf8")) if os.path.exists(mp) else {}
    old.update({"grade": grade, "source": source, "chapters": meta})
    with open(mp, "w", encoding="utf8") as f:
        json.dump(old, f, ensure_ascii=False, indent=2); f.write("\n")
    for d in ("easy", "medium", "hard"):
        p = os.path.join(out_dir, d + ".json")
        if os.path.exists(p):
            os.remove(p)
    print(f"{path}: {len(chapters)} κεφάλαια, {len(qs)} ερωτήσεις")
