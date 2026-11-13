// Πίνακας κατάταξης (leaderboard) για το Play and Learn.
//
// GET  /api/scores?key=1a2b3c4d-easy  -> οι 10 καλύτεροι για μάθημα/δυσκολία
//   Το κλειδί είναι <σταθερό κλειδί μαθήματος>-<τρόπος>, όπου τρόπος:
//   easy | medium | hard | exam (διαγώνισμα) | all (επανάληψη ύλης) | c<κεφάλαιο> (π.χ. c07, c30a)
// POST /api/scores  { key, name, points, correct, total }  -> αποθήκευση σκορ
// GET  /api/scores?checkName=Νίκος     -> { ok: true/false } (έλεγχος ονόματος πριν το παιχνίδι)
//
// Διαχείριση (κρυφή σελίδα #/admin, χρειάζεται τον κωδικό ADMIN_KEY των ρυθμίσεων του Vercel):
// GET    /api/scores?admin=1   (header x-admin-key)  -> όλα τα σκορ, με το url του καθενός
// DELETE /api/scores  { url }  (header x-admin-key)  -> σβήνει ένα σκορ
//
// Κάθε σκορ αποθηκεύεται ως ένα μικρό αρχείο στο Vercel Blob, και όλα τα
// στοιχεία του (πόντοι, χρόνος, όνομα) μπαίνουν μέσα στο ΟΝΟΜΑ του αρχείου.
// Έτσι η ανάγνωση γίνεται με ένα απλό list(), χωρίς να διαβάζουμε αρχεία
// και χωρίς προβλήματα όταν δύο παίκτες τελειώνουν ταυτόχρονα.
const crypto = require("crypto");
const { put, list, del } = require("@vercel/blob");
const { isBlockedName } = require("./_lib/nameFilter");

const KEY_RE = /^[a-f0-9]{8}-(easy|medium|hard|exam|all|c[0-9a-z]{1,6})$/;
const MAX_POINTS_PER_QUESTION = 200;
const TOP = 10;

// ---------- Παλιά σκορ ----------
// Πριν από τα σταθερά κλειδιά, τα σκορ αποθηκεύονταν ως <αριθμός μαθήματος>-<δυσκολία>
// (π.χ. "15-easy"). Η αρίθμηση άλλαξε μία φορά, άρα το ίδιο νούμερο σημαίνει άλλο μάθημα
// ανάλογα με το ΠΟΤΕ μπήκε το σκορ. Τα όρια είναι οι ώρες που ανέβηκε κάθε έκδοση στο Vercel.
//
//   Εποχή 1: μέχρι 12/11/2026 19:01:05 — μόνο τα 9 «γενικά» μαθήματα (0–8), που δεν υπάρχουν πια
//   Εποχή 2: 19:01:05 – 19:59:15 — μαθήματα ανά τάξη (0–16 όπως παρακάτω, 17–25 τα «γενικά»)
//   Από 19:59:15: σταθερά κλειδιά (scores/<κλειδί>-<τρόπος>/)
const ERA2_START = 1794502865253;
const ERA2_END = 1794506424884;

// Νέο σταθερό κλειδί -> αριθμός του ίδιου μαθήματος στην εποχή 2
const ERA2_IDS = {
  "58e4d866": "0", // Ε΄ Δημοτικού — Μαθηματικά
  "0fc78b2c": "1", // Ε΄ Δημοτικού — Γλώσσα
  e535dba8: "2", // Ε΄ Δημοτικού — Ιστορία
  f17584f7: "3", // Ε΄ Δημοτικού — Γεωγραφία
  edeedd41: "4", // Ε΄ Δημοτικού — Φυσικά
  "3d9410d4": "5", // ΣΤ΄ Δημοτικού — Μαθηματικά
  "17b83bec": "6", // ΣΤ΄ Δημοτικού — Γλώσσα
  e8b8fddb: "7", // ΣΤ΄ Δημοτικού — Ιστορία
  "17f5ce06": "8", // ΣΤ΄ Δημοτικού — Γεωγραφία
  f79eb91d: "9", // ΣΤ΄ Δημοτικού — Φυσικά
  b06d60e6: "10", // Γ΄ Γυμνασίου — Μαθηματικά
  "35203fea": "11", // Γ΄ Γυμνασίου — Νεοελληνική Γλώσσα
  "4ef0ba59": "12", // Γ΄ Γυμνασίου — Αρχαία
  "8eb00ed2": "13", // Γ΄ Γυμνασίου — Ιστορία
  aa038aac: "14", // Γ΄ Γυμνασίου — Φυσική
  "63b8d210": "15", // Γ΄ Γυμνασίου — Χημεία
  "766e4934": "16", // Γ΄ Γυμνασίου — Βιολογία
};

// Πού να ψάξει σκορ για ένα κλειδί: { prefix, from, to } (from/to = όρια χρόνου του σκορ)
function sourcesFor(key) {
  const [base, mode] = key.split("-");
  const list = [{ prefix: `scores/${key}/`, from: 0, to: Infinity }];
  if (ERA2_IDS[base] && /^(easy|medium|hard|exam)$/.test(mode)) {
    list.push({
      prefix: `scores/${ERA2_IDS[base]}-${mode}/`,
      from: ERA2_START,
      to: ERA2_END,
    });
  }
  return list;
}

function toHex(text) {
  return Buffer.from(text, "utf8").toString("hex");
}

function fromHex(text) {
  try {
    return Buffer.from(text, "hex").toString("utf8");
  } catch {
    return "?";
  }
}

function cleanName(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

// Σωστός κωδικός διαχειριστή; (σύγκριση σταθερού χρόνου)
function isAdmin(req) {
  const expected = process.env.ADMIN_KEY || "";
  const given = String(req.headers["x-admin-key"] || "");
  if (!expected || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function parseBlob(blob) {
  // scores/<key>/<points>_<correct>_<total>_<time>_<name>_<random>.txt
  const parts = blob.pathname.split("/");
  const file = parts.pop().replace(/\.txt$/, "");
  const [points, correct, total, time, name] = file.split("_");
  return {
    key: parts[1] || "",
    points: Number(points),
    correct: Number(correct),
    total: Number(total),
    time: Number(time),
    name: fromHex(name || ""),
    url: blob.url,
  };
}

async function readAll() {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: "scores/", cursor, limit: 1000 });
    for (const blob of page.blobs) out.push(parseBlob(blob));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => b.time - a.time);
}

async function readTop(key) {
  const entries = [];
  for (const { prefix, from, to } of sourcesFor(key)) {
    let cursor;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        const e = parseBlob(blob);
        if (!(e.time >= from && e.time < to)) continue; // σκορ άλλης εποχής
        if (isBlockedName(e.name)) continue; // παλιό σκορ με όνομα που δεν επιτρέπεται
        entries.push({
          points: e.points,
          correct: e.correct,
          total: e.total,
          time: e.time,
          name: e.name,
        });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }

  entries.sort((a, b) => b.points - a.points || a.time - b.time);
  return entries.slice(0, TOP);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res
      .status(503)
      .json({ error: "Ο πίνακας κατάταξης δεν είναι ρυθμισμένος" });
  }

  try {
    if (req.method === "GET" && req.query.checkName !== undefined) {
      const name = cleanName(req.query.checkName);
      return res.status(200).json({ ok: !isBlockedName(name) });
    }

    if (req.method === "GET" && req.query.admin) {
      if (!isAdmin(req))
        return res.status(401).json({ error: "Λάθος κωδικός" });
      return res.status(200).json({ scores: await readAll() });
    }

    if (req.method === "DELETE") {
      if (!isAdmin(req))
        return res.status(401).json({ error: "Λάθος κωδικός" });
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      let url;
      try {
        url = new URL(String(body.url || ""));
      } catch {
        return res.status(400).json({ error: "Λάθος σκορ" });
      }
      // σβήνουμε ΜΟΝΟ αρχεία σκορ του δικού μας αποθηκευτικού χώρου
      if (
        !url.hostname.endsWith(".blob.vercel-storage.com") ||
        !url.pathname.startsWith("/scores/")
      ) {
        return res.status(400).json({ error: "Λάθος σκορ" });
      }
      await del(url.toString());
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET") {
      const key = String(req.query.key || "");
      if (!KEY_RE.test(key))
        return res.status(400).json({ error: "Λάθος μάθημα" });
      return res.status(200).json({ scores: await readTop(key) });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      const key = String(body.key || "");
      const name = cleanName(body.name);
      const total = Math.floor(Number(body.total));
      const correct = Math.floor(Number(body.correct));
      const points = Math.floor(Number(body.points));

      if (!KEY_RE.test(key))
        return res.status(400).json({ error: "Λάθος μάθημα" });
      if (!name) return res.status(400).json({ error: "Γράψε όνομα" });
      if (isBlockedName(name)) {
        return res.status(400).json({
          error:
            "Αυτό το όνομα δεν επιτρέπεται. Διάλεξε άλλο όνομα για την κατάταξη.",
          code: "name",
        });
      }
      if (!(total >= 1 && total <= 50))
        return res.status(400).json({ error: "Λάθος στοιχεία" });
      if (!(correct >= 0 && correct <= total))
        return res.status(400).json({ error: "Λάθος στοιχεία" });
      if (!(points >= 0 && points <= correct * MAX_POINTS_PER_QUESTION)) {
        return res.status(400).json({ error: "Λάθος στοιχεία" });
      }

      const time = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const pathname = `scores/${key}/${String(points).padStart(6, "0")}_${correct}_${total}_${time}_${toHex(name)}_${rand}.txt`;
      await put(pathname, "1", {
        access: "public",
        addRandomSuffix: false,
        contentType: "text/plain",
      });

      const scores = await readTop(key);
      const rank =
        scores.findIndex((s) => s.time === time && s.name === name) + 1;
      return res.status(200).json({ scores, rank });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Σφάλμα διακομιστή" });
  }
};
