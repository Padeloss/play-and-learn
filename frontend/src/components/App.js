import React, { useCallback, useEffect, useRef, useState } from "react";
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

const SECONDS_PER_QUESTION = 20;
const BASE_POINTS = 100; // για σωστή απάντηση
const SPEED_POINTS = 100; // επιπλέον, ανάλογα με το πόσο γρήγορα απάντησες

const BEST_KEY = "playandlearn-best-points";
const NAME_KEY = "playandlearn-name";
const SOUND_KEY = "playandlearn-sound";

// ---------- Βοηθητικά ----------

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

function readStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* δεν πειράζει */
  }
}

function subjectName(s) {
  return s.name === "python" ? "Python" : s.name;
}

const sounds = {
  correct: typeof Audio !== "undefined" ? new Audio("/sounds/correct.mp3") : null,
  wrong: typeof Audio !== "undefined" ? new Audio("/sounds/wrong.mp3") : null,
};

function playSound(name, enabled) {
  const s = sounds[name];
  if (!enabled || !s) return;
  try {
    s.currentTime = 0;
    const p = s.play();
    if (p && p.catch) p.catch(() => {});
  } catch {
    /* ο browser δεν άφησε να παίξει ήχος */
  }
}

// ---------- Πίνακας κατάταξης ----------

function Leaderboard({ scores, loading, error, highlight }) {
  if (loading) return <p className="muted">Φόρτωση κατάταξης…</p>;
  if (error) return <p className="muted">{error}</p>;
  if (!scores || scores.length === 0) {
    return <p className="muted">Δεν υπάρχει ακόμα κανένα σκορ. Γίνε ο πρώτος! 🚀</p>;
  }
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <ol className="board">
      {scores.map((s, i) => (
        <li key={`${s.time}-${i}`} className={highlight === i + 1 ? "me" : ""}>
          <span className="pos">{medals[i] || i + 1}</span>
          <span className="who">{s.name}</span>
          <span className="pts">
            {s.points} π. <small>({s.correct}/{s.total})</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

async function fetchBoard(key) {
  const r = await fetch(`/api/scores?key=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error();
  return (await r.json()).scores || [];
}

// ---------- Εφαρμογή ----------

function App() {
  const [subjects, setSubjects] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState(() => readStorage(NAME_KEY, ""));
  const [soundOn, setSoundOn] = useState(() => readStorage(SOUND_KEY, true));
  const [best, setBest] = useState(() => readStorage(BEST_KEY, {}));

  // κουίζ
  const [subject, setSubject] = useState(null);
  const [level, setLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState(null); // index, ή -1 αν τελείωσε ο χρόνος
  const [correctCount, setCorrectCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [finished, setFinished] = useState(false);

  // κατάταξη
  const [boardFor, setBoardFor] = useState(null); // { subject, level } όταν βλέπουμε μόνο κατάταξη
  const [board, setBoard] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [myRank, setMyRank] = useState(0);

  const questionStart = useRef(0);

  useEffect(() => {
    fetch("/lessons/index.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setSubjects)
      .catch(() => setError("Δεν φορτώθηκαν τα μαθήματα. Δοκίμασε ξανά."));
  }, []);

  useEffect(() => writeStorage(NAME_KEY, name), [name]);
  useEffect(() => writeStorage(SOUND_KEY, soundOn), [soundOn]);

  const answer = useCallback(
    (index) => {
      if (picked !== null || !questions[current]) return;
      setPicked(index);
      const isCorrect = index >= 0 && questions[current].choices[index].correct;
      if (isCorrect) {
        const elapsed = (Date.now() - questionStart.current) / 1000;
        const left = Math.max(0, SECONDS_PER_QUESTION - elapsed);
        const gain = BASE_POINTS + Math.round((SPEED_POINTS * left) / SECONDS_PER_QUESTION);
        setCorrectCount((c) => c + 1);
        setPoints((p) => p + gain);
        setLastGain(gain);
        playSound("correct", soundOn);
      } else {
        setLastGain(0);
        playSound("wrong", soundOn);
      }
    },
    [picked, questions, current, soundOn]
  );

  // Χρονόμετρο ερώτησης
  useEffect(() => {
    if (!subject || finished || picked !== null || questions.length === 0) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - questionStart.current) / 1000;
      const left = Math.max(0, SECONDS_PER_QUESTION - elapsed);
      setTimeLeft(left);
      if (left <= 0) answer(-1);
    }, 100);
    return () => clearInterval(id);
  }, [subject, finished, picked, questions, current, answer]);

  function startQuestion() {
    questionStart.current = Date.now();
    setTimeLeft(SECONDS_PER_QUESTION);
    setPicked(null);
    setLastGain(0);
  }

  function startQuiz(subj, lvl) {
    setError("");
    fetch(`/lessons/${subj.id}/${lvl}.json`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setBoardFor(null);
        setSubject(subj);
        setLevel(lvl);
        setQuestions(prepareQuestions(data));
        setCurrent(0);
        setCorrectCount(0);
        setPoints(0);
        setFinished(false);
        setBoard(null);
        setMyRank(0);
        startQuestion();
      })
      .catch(() => setError("Δεν φορτώθηκαν οι ερωτήσεις. Δοκίμασε ξανά."));
  }

  function next() {
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      startQuestion();
      return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    const key = `${subject.id}-${level}`;
    if (!best[key] || points > best[key]) {
      const updated = { ...best, [key]: points };
      setBest(updated);
      writeStorage(BEST_KEY, updated);
    }
    setFinished(true);

    setBoardLoading(true);
    setBoardError("");
    const player = name.trim();
    const request = player
      ? fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            name: player,
            points,
            correct: correctCount,
            total: questions.length,
          }),
        }).then(async (r) => {
          if (!r.ok) throw new Error();
          const data = await r.json();
          setMyRank(data.rank || 0);
          return data.scores || [];
        })
      : fetchBoard(key);

    request
      .then(setBoard)
      .catch(() => setBoardError("Η κατάταξη δεν είναι διαθέσιμη αυτή τη στιγμή."))
      .finally(() => setBoardLoading(false));
  }

  function openBoard(subj, lvl) {
    setBoardFor({ subject: subj, level: lvl });
    setBoard(null);
    setMyRank(0);
    setBoardLoading(true);
    setBoardError("");
    fetchBoard(`${subj.id}-${lvl}`)
      .then(setBoard)
      .catch(() => setBoardError("Η κατάταξη δεν είναι διαθέσιμη αυτή τη στιγμή."))
      .finally(() => setBoardLoading(false));
  }

  function goHome() {
    setSubject(null);
    setLevel(null);
    setQuestions([]);
    setFinished(false);
    setBoardFor(null);
  }

  // ---------- Οθόνες ----------

  const header = (
    <header className="top">
      <button className="logo" onClick={goHome}>
        🎮 Play and Learn
      </button>
      <button
        className="icon-btn"
        onClick={() => setSoundOn(!soundOn)}
        aria-label={soundOn ? "Σίγαση ήχου" : "Ενεργοποίηση ήχου"}
        title={soundOn ? "Σίγαση ήχου" : "Ενεργοποίηση ήχου"}
      >
        {soundOn ? "🔊" : "🔇"}
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

  // Μόνο κατάταξη
  if (boardFor) {
    const { subject: s, level: lv } = boardFor;
    return (
      <div className="page">
        {header}
        <h1>
          🏆 {ICONS[s.name] || "📘"} {subjectName(s)}
        </h1>
        <div className="tabs">
          {s.levels.map(({ level: l }) => (
            <button
              key={l}
              className={`tab ${l === lv ? "active" : ""}`}
              onClick={() => openBoard(s, l)}
            >
              {LEVELS[l].emoji} {LEVELS[l].label}
            </button>
          ))}
        </div>
        <div className="panel">
          <Leaderboard scores={board} loading={boardLoading} error={boardError} />
        </div>
        <div className="actions">
          <button className="primary" onClick={() => startQuiz(s, lv)}>
            Παίξε {LEVELS[lv].label}
          </button>
          <button className="secondary" onClick={goHome}>
            Πίσω
          </button>
        </div>
      </div>
    );
  }

  // Αρχική
  if (!subject) {
    return (
      <div className="page">
        {header}
        <div className="panel name-panel">
          <label htmlFor="player">Το όνομά σου (για την κατάταξη)</label>
          <input
            id="player"
            value={name}
            maxLength={20}
            placeholder="π.χ. Νίκος Π."
            onChange={(e) => setName(e.target.value)}
          />
          <small className="muted">
            Αν το αφήσεις κενό, παίζεις κανονικά αλλά δεν μπαίνεις στην κατάταξη. Μη γράφεις
            επώνυμο ολόκληρο — φαίνεται σε όλους.
          </small>
        </div>

        <h1>Διάλεξε μάθημα και δυσκολία</h1>
        <p className="muted rules">
          ⏱️ {SECONDS_PER_QUESTION} δευτερόλεπτα ανά ερώτηση · ✅ {BASE_POINTS} πόντοι για
          σωστή + έως {SPEED_POINTS} μπόνους ταχύτητας
        </p>
        {error && <p className="error">{error}</p>}
        <div className="grid">
          {subjects.map((s) => (
            <div className="card" key={s.id}>
              <div className="card-title">
                <span className="icon">{ICONS[s.name] || "📘"}</span>
                <span className="grow">{subjectName(s)}</span>
                <button
                  className="link"
                  onClick={() => openBoard(s, s.levels[0].level)}
                  title="Κατάταξη"
                >
                  🏆
                </button>
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
                        {count} ερωτ.{b !== undefined ? ` · ρεκόρ ${b} π.` : ""}
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
    const percent = Math.round((correctCount / questions.length) * 100);
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
          <div className="big">{points} πόντοι</div>
          <p className="muted">
            {correctCount}/{questions.length} σωστές ({percent}%) · {subjectName(subject)} ·{" "}
            {LEVELS[level].label}
          </p>
          {myRank > 0 && <p className="rank">Είσαι στη θέση #{myRank} της κατάταξης! 🎉</p>}
          {!name.trim() && (
            <p className="muted">Γράψε όνομα στην αρχική για να μπαίνεις στην κατάταξη.</p>
          )}
          <div className="actions">
            <button className="primary" onClick={() => startQuiz(subject, level)}>
              Ξανά
            </button>
            <button className="secondary" onClick={goHome}>
              Άλλο μάθημα
            </button>
          </div>
        </div>
        <h2 className="board-title">🏆 Κατάταξη — top 10</h2>
        <div className="panel">
          <Leaderboard
            scores={board}
            loading={boardLoading}
            error={boardError}
            highlight={myRank}
          />
        </div>
      </div>
    );
  }

  // Ερώτηση
  const q = questions[current];
  const progress = ((current + (picked !== null ? 1 : 0)) / questions.length) * 100;
  const timePercent = (timeLeft / SECONDS_PER_QUESTION) * 100;
  const timeClass = timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "";

  return (
    <div className="page">
      {header}
      <div className="quiz-info">
        <span>
          {ICONS[subject.name] || "📘"} {subjectName(subject)} · {LEVELS[level].label}
        </span>
        <span>
          {current + 1}/{questions.length} · <b>{points} π.</b>
        </span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className={`timer ${timeClass}`}>
        <div className="timer-fill" style={{ width: `${timePercent}%` }} />
        <span>⏱️ {Math.ceil(timeLeft)}″</span>
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
            <button key={i} className={cls} onClick={() => answer(i)}>
              {c.text}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="feedback">
          <span>
            {picked === -1
              ? "⏰ Τέλος χρόνου!"
              : q.choices[picked].correct
              ? `✅ Σωστό! +${lastGain}`
              : "❌ Λάθος"}
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
