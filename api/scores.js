// Πίνακας κατάταξης (leaderboard) για το Play and Learn.
//
// GET  /api/scores?key=1a2b3c4d-easy  -> οι 10 καλύτεροι για μάθημα/δυσκολία
//   Το κλειδί είναι <σταθερό κλειδί μαθήματος>-<τρόπος>, όπου τρόπος:
//   easy | medium | hard | exam (διαγώνισμα) | all (επανάληψη ύλης) | c<κεφάλαιο> (π.χ. c07, c30a)
// POST /api/scores  { key, name, points, correct, total }  -> αποθήκευση σκορ
//
// Κάθε σκορ αποθηκεύεται ως ένα μικρό αρχείο στο Vercel Blob, και όλα τα
// στοιχεία του (πόντοι, χρόνος, όνομα) μπαίνουν μέσα στο ΟΝΟΜΑ του αρχείου.
// Έτσι η ανάγνωση γίνεται με ένα απλό list(), χωρίς να διαβάζουμε αρχεία
// και χωρίς προβλήματα όταν δύο παίκτες τελειώνουν ταυτόχρονα.
const { put, list } = require("@vercel/blob");

const KEY_RE = /^[a-f0-9]{8}-(easy|medium|hard|exam|all|c[0-9a-z]{1,6})$/;
const MAX_POINTS_PER_QUESTION = 200;

// Παλιά σκορ (πριν από τις 12/11/2026) αποθηκεύτηκαν με κλειδί <αριθμός μαθήματος>-<δυσκολία>,
// π.χ. "15-easy". Εδώ λέμε ποιο παλιό νούμερο αντιστοιχεί σε κάθε νέο σταθερό κλειδί, ώστε η
// κατάταξη να δείχνει μαζί παλιά και νέα σκορ. Ισχύει για easy/medium/hard/exam.
const LEGACY_IDS = {
  "58e4d866": "0", // Ε΄ Δημοτικού — Μαθηματικά
  "0fc78b2c": "1", // Ε΄ Δημοτικού — Γλώσσα
  e535dba8: "2", // Ε΄ Δημοτικού — Ιστορία (τα παλιά σκορ δυσκολίας δεν έχουν πια κουίζ)
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

// Όλοι οι φάκελοι όπου μπορεί να υπάρχουν σκορ για ένα κλειδί (νέος + παλιός)
function prefixesFor(key) {
  const [base, mode] = key.split("-");
  const list = [`scores/${key}/`];
  if (LEGACY_IDS[base] && /^(easy|medium|hard|exam)$/.test(mode)) {
    list.push(`scores/${LEGACY_IDS[base]}-${mode}/`);
  }
  return list;
}
const TOP = 10;

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

async function readTop(key) {
  const entries = [];
  for (const prefix of prefixesFor(key)) {
    let cursor;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        // scores/<key>/<points>_<correct>_<total>_<time>_<name>_<random>.txt
        const file = blob.pathname
          .split("/")
          .pop()
          .replace(/\.txt$/, "");
        const [points, correct, total, time, name] = file.split("_");
        entries.push({
          points: Number(points),
          correct: Number(correct),
          total: Number(total),
          time: Number(time),
          name: fromHex(name || ""),
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

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Σφάλμα διακομιστή" });
  }
};
