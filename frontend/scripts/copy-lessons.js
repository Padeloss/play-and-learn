// Αντιγράφει τις ερωτήσεις από το backend/lessons στο frontend/public/lessons
// ώστε η εφαρμογή να δουλεύει ως απλό στατικό site (χωρίς server).
// Τα ονόματα φακέλων γίνονται αριθμοί (0, 1, 2...) για να μην υπάρχουν
// προβλήματα με ελληνικούς χαρακτήρες στις διευθύνσεις.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "backend", "lessons");
const dest = path.join(__dirname, "..", "public", "lessons");
const levels = ["easy", "medium", "hard"];

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

const subjects = fs
  .readdirSync(src, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name.normalize("NFC"))
  .sort((a, b) => a.localeCompare(b, "el"));

const index = [];
subjects.forEach((name, i) => {
  const out = path.join(dest, String(i));
  fs.mkdirSync(out, { recursive: true });
  const available = [];
  for (const level of levels) {
    const file = path.join(src, name, `${level}.json`);
    if (!fs.existsSync(file)) continue;
    const questions = JSON.parse(fs.readFileSync(file, "utf8"));
    fs.writeFileSync(path.join(out, `${level}.json`), JSON.stringify(questions));
    available.push({ level, count: questions.length });
  }
  index.push({ id: String(i), name, levels: available });
});

fs.writeFileSync(path.join(dest, "index.json"), JSON.stringify(index, null, 2));
console.log(`✔ Αντιγράφηκαν ${index.length} μαθήματα στο public/lessons`);
