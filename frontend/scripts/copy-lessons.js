// Αντιγράφει τις ερωτήσεις από το backend/lessons στο frontend/public/lessons
// ώστε η εφαρμογή να δουλεύει ως απλό στατικό site (χωρίς server).
//
// Δομή του backend/lessons:
//   grades.json                          -> οι τάξεις, η σειρά των μαθημάτων και το θέμα ήχων ("sound": "kids" | "metal")
//   <Τάξη>/<Μάθημα>/meta.json            -> { "grade": "...", "chapters": [ { "id": "01", "title": "..." } ] }
//   <Τάξη>/<Μάθημα>/chapters/<id>.json   -> ερωτήσεις ενός κεφαλαίου (αν το μάθημα έχει κεφάλαια)
//   <Τάξη>/<Μάθημα>/easy.json, medium.json, hard.json
//                                        -> ερωτήσεις ανά δυσκολία (για μαθήματα χωρίς κεφάλαια)
//
// Μορφή ερώτησης: { "question": "...", "choices": ["1. ...", "2. ..."], "answer": "2" }
//
// Στο public/lessons τα μαθήματα παίρνουν αριθμούς (0, 1, 2...) για να μην υπάρχουν
// προβλήματα με ελληνικούς χαρακτήρες στις διευθύνσεις. Για την κατάταξη κάθε μάθημα
// παίρνει ένα ΣΤΑΘΕΡΟ κλειδί (από το όνομα τάξης + μαθήματος), ώστε τα σκορ να μη
// μπερδεύονται όταν προστίθενται ή αφαιρούνται μαθήματα.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const src = path.join(__dirname, "..", "..", "backend", "lessons");
const dest = path.join(__dirname, "..", "public", "lessons");
const levels = ["easy", "medium", "hard"];

const nfc = (s) => String(s).normalize("NFC");

function fail(message) {
  console.error(`✘ ${message}`);
  process.exit(1);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    fail(`Λάθος στο αρχείο ${path.relative(src, file)}: ${e.message}`);
  }
}

// Έλεγχος ότι κάθε ερώτηση έχει σωστή μορφή, ώστε ένα λάθος να φανεί στο build
function checkQuestions(list, file) {
  const where = path.relative(src, file);
  if (!Array.isArray(list) || list.length === 0) fail(`${where}: δεν έχει ερωτήσεις`);
  list.forEach((q, i) => {
    const n = Number(q.answer);
    if (!q.question || !Array.isArray(q.choices) || q.choices.length < 2) {
      fail(`${where}: η ερώτηση #${i + 1} δεν έχει κείμενο ή επιλογές`);
    }
    if (!(n >= 1 && n <= q.choices.length)) {
      fail(`${where}: η ερώτηση #${i + 1} έχει λάθος σωστή απάντηση ("${q.answer}")`);
    }
  });
  return list;
}

function stableKey(...parts) {
  return crypto.createHash("sha1").update(parts.map(nfc).join("|")).digest("hex").slice(0, 8);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

const grades = readJson(path.join(src, "grades.json"));

let nextId = 0;
let totalQuestions = 0;
const index = grades.map((g) => {
  const gradeDir = path.join(src, g.folder);
  if (!fs.existsSync(gradeDir)) fail(`Δεν υπάρχει ο φάκελος τάξης "${g.folder}"`);
  const order = (g.order || []).map(nfc);
  const subjects = fs
    .readdirSync(gradeDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort((a, b) => {
      // πρώτα η σειρά που ορίζει το grades.json ("order"), μετά αλφαβητικά
      const ia = order.indexOf(nfc(a));
      const ib = order.indexOf(nfc(b));
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return nfc(a).localeCompare(nfc(b), "el");
    });

  const list = subjects.map((name) => {
    const id = String(nextId++);
    const subjDir = path.join(gradeDir, name);
    const out = path.join(dest, id);
    fs.mkdirSync(out, { recursive: true });

    const metaFile = path.join(subjDir, "meta.json");
    const meta = fs.existsSync(metaFile) ? readJson(metaFile) : {};

    // Κεφάλαια
    const chapters = [];
    if (Array.isArray(meta.chapters) && meta.chapters.length > 0) {
      fs.mkdirSync(path.join(out, "chapters"), { recursive: true });
      for (const ch of meta.chapters) {
        if (!/^[0-9a-z]{1,6}$/.test(ch.id)) fail(`${name}: λάθος id κεφαλαίου "${ch.id}"`);
        const file = path.join(subjDir, "chapters", `${ch.id}.json`);
        if (!fs.existsSync(file)) continue; // κεφάλαιο χωρίς ερωτήσεις ακόμα
        const questions = checkQuestions(readJson(file), file);
        fs.writeFileSync(path.join(out, "chapters", `${ch.id}.json`), JSON.stringify(questions));
        chapters.push({
          id: ch.id,
          num: ch.num || String(ch.id).replace(/^0+/, ""),
          title: nfc(ch.title),
          unit: ch.unit ? nfc(ch.unit) : undefined,
          count: questions.length,
        });
        totalQuestions += questions.length;
      }
    }

    // Δυσκολίες (για μαθήματα χωρίς κεφάλαια ακόμα)
    const available = [];
    for (const level of levels) {
      const file = path.join(subjDir, `${level}.json`);
      if (!fs.existsSync(file)) continue;
      const questions = checkQuestions(readJson(file), file);
      fs.writeFileSync(path.join(out, `${level}.json`), JSON.stringify(questions));
      available.push({ level, count: questions.length });
      totalQuestions += questions.length;
    }

    if (chapters.length === 0 && available.length === 0) fail(`${g.folder}/${name}: δεν έχει ερωτήσεις`);

    return {
      id,
      key: stableKey(g.folder, meta.keyName || name), // keyName: παλιό όνομα μαθήματος, ώστε να μη χαθούν σκορ
      name: nfc(name),
      grade: meta.grade || g.title,
      source: meta.source || undefined,
      chapters,
      levels: available,
      total:
        chapters.reduce((n, c) => n + c.count, 0) + available.reduce((n, l) => n + l.count, 0),
    };
  });

  return {
    title: g.title,
    icon: g.icon || "📘",
    exam: Boolean(g.exam),
    examTitle: g.examTitle || "Διαγώνισμα",
    sound: g.sound === "metal" ? "metal" : "kids", // θέμα ήχων: kids (Δημοτικό) ή metal (Γυμνάσιο)
    subjects: list,
  };
});

// Τα κλειδιά κατάταξης πρέπει να είναι μοναδικά
const keys = index.flatMap((g) => g.subjects.map((s) => s.key));
if (new Set(keys).size !== keys.length) fail("Δύο μαθήματα πήραν το ίδιο κλειδί κατάταξης");

fs.writeFileSync(path.join(dest, "index.json"), JSON.stringify(index, null, 2));
const total = index.reduce((n, g) => n + g.subjects.length, 0);
console.log(
  `✔ Αντιγράφηκαν ${total} μαθήματα σε ${index.length} τάξεις (${totalQuestions} ερωτήσεις) στο public/lessons`
);
