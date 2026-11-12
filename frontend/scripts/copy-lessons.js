// Αντιγράφει τις ερωτήσεις από το backend/lessons στο frontend/public/lessons
// ώστε η εφαρμογή να δουλεύει ως απλό στατικό site (χωρίς server).
//
// Δομή του backend/lessons:
//   grades.json                     -> οι ομάδες (τάξεις) και η σειρά τους
//   <Τάξη>/<Μάθημα>/meta.json       -> { "grade": "σε ποια τάξη απευθύνεται" }
//   <Τάξη>/<Μάθημα>/easy.json, medium.json, hard.json
//
// Τα μαθήματα παίρνουν αριθμούς (0, 1, 2...) για να μην υπάρχουν
// προβλήματα με ελληνικούς χαρακτήρες στις διευθύνσεις.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "backend", "lessons");
const dest = path.join(__dirname, "..", "public", "lessons");
const levels = ["easy", "medium", "hard"];

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

const grades = JSON.parse(fs.readFileSync(path.join(src, "grades.json"), "utf8"));

let nextId = 0;
const index = grades.map((g) => {
  const gradeDir = path.join(src, g.folder);
  const subjects = fs
    .readdirSync(gradeDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort((a, b) => {
      // πρώτα η σειρά που ορίζει το grades.json ("order"), μετά αλφαβητικά
      const order = (g.order || []).map((x) => x.normalize("NFC"));
      const ia = order.indexOf(a.normalize("NFC"));
      const ib = order.indexOf(b.normalize("NFC"));
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.normalize("NFC").localeCompare(b.normalize("NFC"), "el");
    });

  const list = subjects.map((name) => {
    const id = String(nextId++);
    const subjDir = path.join(gradeDir, name);
    const out = path.join(dest, id);
    fs.mkdirSync(out, { recursive: true });

    let grade = g.title;
    const metaFile = path.join(subjDir, "meta.json");
    if (fs.existsSync(metaFile)) {
      grade = JSON.parse(fs.readFileSync(metaFile, "utf8")).grade || grade;
    }

    const available = [];
    for (const level of levels) {
      const file = path.join(subjDir, `${level}.json`);
      if (!fs.existsSync(file)) continue;
      const questions = JSON.parse(fs.readFileSync(file, "utf8"));
      fs.writeFileSync(path.join(out, `${level}.json`), JSON.stringify(questions));
      available.push({ level, count: questions.length });
    }
    return { id, name: name.normalize("NFC"), grade, levels: available };
  });

  return {
    title: g.title,
    icon: g.icon || "📘",
    exam: Boolean(g.exam),
    examTitle: g.examTitle || "Διαγώνισμα",
    subjects: list,
  };
});

fs.writeFileSync(path.join(dest, "index.json"), JSON.stringify(index, null, 2));
const total = index.reduce((n, g) => n + g.subjects.length, 0);
console.log(`✔ Αντιγράφηκαν ${total} μαθήματα σε ${index.length} ομάδες στο public/lessons`);
