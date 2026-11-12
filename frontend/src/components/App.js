import React, { useEffect, useState } from "react";
import "../index.css";

const LEVELS = {
  easy: { label: "Εύκολο", emoji: "🟢" },
  medium: { label: "Μέτριο", emoji: "🟡" },
  hard: { label: "Δύσκολο", emoji: "🔴" },
};

const ICONS = {
  "Άλγεβρα": "➗",
  "Αρχαία (κείμενα)": "🏛️",
  "Βιολογία": "🧬",
  "Γεωγραφία": "🌍",
  "Γεωμετρία": "📐",
  "Ιστορία": "📜",
  "Νεοελληνικά": "📖",
  "Φυσική": "⚛️",
  python: "🐍",
};

const BEST_KEY = "playandlearn-best";

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "3. Κείμενο" -> "Κείμενο"
function cleanChoice(text) {
  return String(text).replace(/^\s*\d+[.)]\s*/, "");
}

function prepareQuestions(raw) {
  return shuffle(raw).map((q) => {
    const correctIndex = parseInt(q.answer, 10) - 1;
    const choices = q.choices.map((c, i) => ({
      text: cleanChoice(c),
      correct: i === correctIndex,
    }));
    return { question: q.question, choices: shuffle(choices) };
  });
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBest(best) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* δεν πειράζει */
  }
}

function App() {
  const [subjects, setSubjects] = useState(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState(loadBest);

  useEffect(() => {
    fetch("/lessons/index.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setSubjects)
      .catch(() => setError("Δεν φορτώθηκαν τα μαθήματα. Δοκίμασε ξανά."));
  }, []);

  function startQuiz(subj, lvl) {
    setError("");
    fetch(`/lessons/${subj.id}/${lvl}.json`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setSubject(subj);
        setLevel(lvl);
        setQuestions(prepareQuestions(data));
        setCurrent(0);
        setPicked(null);
        setScore(0);
        setFinished(false);
      })
      .catch(() => setError("Δεν φορτώθηκαν οι ερωτήσεις. Δοκίμασε ξανά."));
  }

  function choose(index) {
    if (picked !== null) return;
    setPicked(index);
    if (questions[current].choices[index].correct) setScore((s) => s + 1);
  }

  function next() {
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      setPicked(null);
      return;
    }
    const key = `${subject.id}-${level}`;
    const percent = Math.round((score / questions.length) * 100);
    if (!best[key] || percent > best[key]) {
      const updated = { ...best, [key]: percent };
      setBest(updated);
      saveBest(updated);
    }
    setFinished(true);
  }

  function goHome() {
    setSubject(null);
    setLevel(null);
    setQuestions([]);
    setFinished(false);
  }

  // ---------- Οθόνες ----------

  const header = (
    <header className="top">
      <button className="logo" onClick={goHome}>
        🎮 Play and Learn
      </button>
    </header>
  );

  if (error && !subjects) {
    return (
      <div className="page">
        {header}
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!subjects) {
    return (
      <div className="page">
        {header}
        <p className="muted">Φόρτωση…</p>
      </div>
    );
  }

  // Αρχική: επιλογή μαθήματος και δυσκολίας
  if (!subject) {
    return (
      <div className="page">
        {header}
        <h1>Διάλεξε μάθημα και δυσκολία</h1>
        {error && <p className="error">{error}</p>}
        <div className="grid">
          {subjects.map((s) => (
            <div className="card" key={s.id}>
              <div className="card-title">
                <span className="icon">{ICONS[s.name] || "📘"}</span>
                {s.name === "python" ? "Python" : s.name}
              </div>
              <div className="levels">
                {s.levels.map(({ level: lv, count }) => {
                  const b = best[`${s.id}-${lv}`];
                  return (
                    <button
                      key={lv}
                      className={`level ${lv}`}
                      onClick={() => startQuiz(s, lv)}
                    >
                      <span>
                        {LEVELS[lv].emoji} {LEVELS[lv].label}
                      </span>
                      <small>
                        {count} ερωτ.{b !== undefined ? ` · ρεκόρ ${b}%` : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Τέλος κουίζ
  if (finished) {
    const percent = Math.round((score / questions.length) * 100);
    const message =
      percent === 100
        ? "Τέλειο! 🏆"
        : percent >= 80
        ? "Μπράβο! 🎉"
        : percent >= 50
        ? "Καλή προσπάθεια! 👍"
        : "Συνέχισε την εξάσκηση! 💪";
    return (
      <div className="page">
        {header}
        <div className="result">
          <h1>{message}</h1>
          <div className="big">
            {score} / {questions.length}
          </div>
          <p className="muted">
            {subject.name === "python" ? "Python" : subject.name} ·{" "}
            {LEVELS[level].label} · {percent}%
          </p>
          <div className="actions">
            <button className="primary" onClick={() => startQuiz(subject, level)}>
              Ξανά
            </button>
            <button className="secondary" onClick={goHome}>
              Άλλο μάθημα
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ερώτηση
  const q = questions[current];
  const progress = ((current + (picked !== null ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="page">
      {header}
      <div className="quiz-info">
        <span>
          {ICONS[subject.name] || "📘"}{" "}
          {subject.name === "python" ? "Python" : subject.name} ·{" "}
          {LEVELS[level].label}
        </span>
        <span>
          Ερώτηση {current + 1}/{questions.length} · Σκορ {score}
        </span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <h2 className="question">{q.question}</h2>

      <div className="choices">
        {q.choices.map((c, i) => {
          let cls = "choice";
          if (picked !== null) {
            if (c.correct) cls += " correct";
            else if (i === picked) cls += " wrong";
            else cls += " faded";
          }
          return (
            <button key={i} className={cls} onClick={() => choose(i)}>
              {c.text}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="feedback">
          <span>
            {q.choices[picked].correct ? "✅ Σωστό!" : "❌ Λάθος"}
          </span>
          <button className="primary" onClick={next}>
            {current + 1 < questions.length ? "Επόμενη →" : "Αποτέλεσμα"}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
