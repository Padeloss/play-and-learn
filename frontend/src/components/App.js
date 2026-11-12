import React, { useCallback, useEffect, useRef, useState } from "react";
import "../index.css";

// Τρόποι παιχνιδιού ("mode"):
//   easy | medium | hard  -> ερωτήσεις μιας δυσκολίας (μαθήματα χωρίς κεφάλαια)
//   c<id>                 -> ένα κεφάλαιο, π.χ. c07 ή c30a
//   all                   -> Επανάληψη όλης της ύλης (τυχαίες ερωτήσεις από όλο το μάθημα)
//   exam                  -> Διαγώνισμα (όπως το all, με περισσότερο χρόνο και βαθμό στα 20)
const LEVELS = {
  easy: { label: "Εύκολο", emoji: "🟢" },
  medium: { label: "Μέτριο", emoji: "🟡" },
  hard: { label: "Δύσκολο", emoji: "🔴" },
};

const ICONS = {
  "Αρχαία": "🏛️",
  "Βιολογία": "🧬",
  "Γεωγραφία": "🌍",
  "Ιστορία": "📜",
  "Νεοελληνική Γλώσσα": "📖",
  "Γλώσσα": "✏️",
  "Μαθηματικά": "🔢",
  "Φυσική": "⚛️",
  "Φυσικά": "🔬",
  "Χημεία": "⚗️",
};

const SECONDS_PER_QUESTION = 20;
const SECONDS_PER_EXAM_QUESTION = 30;
const REVIEW_QUESTIONS = 20; // για «Επανάληψη όλης της ύλης» και «Διαγώνισμα»
const BASE_POINTS = 100; // για σωστή απάντηση
const SPEED_POINTS = 100; // επιπλέον, ανάλογα με το πόσο γρήγορα απάντησες

const BEST_KEY = "playandlearn-best-v3";
const NAME_KEY = "playandlearn-name";
const SOUND_KEY = "playandlearn-sound";
const TAB_KEY = "playandlearn-tab";

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

function icon(subject) {
  return ICONS[subject.name] || "📘";
}

function isReview(mode) {
  return mode === "all" || mode === "exam";
}

function chapterOf(subject, mode) {
  if (!mode || mode[0] !== "c") return null;
  return subject.chapters.find((c) => `c${c.id}` === mode) || null;
}

function modeLabel(subject, mode) {
  if (mode === "exam") return subject.examTitle;
  if (mode === "all") return "Επανάληψη όλης της ύλης";
  if (LEVELS[mode]) return LEVELS[mode].label;
  const ch = chapterOf(subject, mode);
  return ch ? `Κεφ. ${ch.num}: ${ch.title}` : mode;
}

function modeEmoji(mode) {
  if (mode === "exam") return "📝";
  if (mode === "all") return "📚";
  if (LEVELS[mode]) return LEVELS[mode].emoji;
  return "📖";
}

// Όλοι οι τρόποι παιχνιδιού ενός μαθήματος, με τη σειρά που εμφανίζονται
function modesOf(subject) {
  return [
    subject.reviewMode,
    ...subject.chapters.map((c) => `c${c.id}`),
    ...subject.levels.map((l) => l.level),
  ];
}

function boardKey(subject, mode) {
  return `${subject.key}-${mode}`;
}

// Βαθμός στα 20, με ένα δεκαδικό (π.χ. 17,5)
function gradeOf20(correct, total) {
  const g = Math.round((correct / total) * 20 * 10) / 10;
  return String(g).replace(".", ",");
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

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error();
  return r.json();
}

async function fetchBoard(key) {
  const data = await fetchJson(`/api/scores?key=${encodeURIComponent(key)}`);
  return data.scores || [];
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

// ---------- Εφαρμογή ----------

function App() {
  const [groups, setGroups] = useState(null);
  const [tab, setTab] = useState(() => readStorage(TAB_KEY, 0));
  const [error, setError] = useState("");
  const [name, setName] = useState(() => readStorage(NAME_KEY, ""));
  const [soundOn, setSoundOn] = useState(() => readStorage(SOUND_KEY, true));
  const [best, setBest] = useState(() => readStorage(BEST_KEY, {}));

  // ποιο μάθημα είναι ανοιχτό (οθόνη μαθήματος)
  const [openSubject, setOpenSubject] = useState(null);

  // κουίζ
  const [subject, setSubject] = useState(null);
  const [mode, setMode] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState(null); // index, ή -1 αν τελείωσε ο χρόνος
  const [correctCount, setCorrectCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState([]); // για την επανάληψη των λαθών
  const [loading, setLoading] = useState(false);

  // κατάταξη
  const [boardFor, setBoardFor] = useState(null);
  const [board, setBoard] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [myRank, setMyRank] = useState(0);

  const questionStart = useRef(0);
  const isExam = mode === "exam";
  const secondsPerQuestion = isExam ? SECONDS_PER_EXAM_QUESTION : SECONDS_PER_QUESTION;

  useEffect(() => {
    fetchJson("/lessons/index.json")
      .then((data) => {
        // κάθε μάθημα «ξέρει» αν η τάξη του έχει διαγώνισμα ή απλή επανάληψη
        const withFlags = data.map((g) => ({
          ...g,
          subjects: g.subjects.map((s) => ({
            ...s,
            examTitle: g.examTitle,
            reviewMode: g.exam ? "exam" : "all",
          })),
        }));
        setGroups(withFlags);
      })
      .catch(() => setError("Δεν φορτώθηκαν τα μαθήματα. Δοκίμασε ξανά."));
  }, []);

  useEffect(() => writeStorage(NAME_KEY, name), [name]);
  useEffect(() => writeStorage(SOUND_KEY, soundOn), [soundOn]);
  useEffect(() => writeStorage(TAB_KEY, tab), [tab]);

  // ---------- Πλοήγηση (και με το κουμπί «πίσω» του κινητού) ----------

  const depth = subject || boardFor ? 2 : openSubject ? 1 : 0;
  const depthRef = useRef(0);
  depthRef.current = depth;

  function pushLevel() {
    try {
      window.history.pushState({ pal: true }, "");
    } catch {
      /* δεν πειράζει */
    }
  }

  const closeInner = useCallback(() => {
    setSubject(null);
    setMode(null);
    setQuestions([]);
    setFinished(false);
    setBoardFor(null);
  }, []);

  useEffect(() => {
    function onPop() {
      if (depthRef.current === 2) closeInner();
      else if (depthRef.current === 1) setOpenSubject(null);
      window.scrollTo(0, 0);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [closeInner]);

  // Πίσω ένα επίπεδο (μέσα από την εφαρμογή)
  function back() {
    if (depth > 0) window.history.back();
  }

  // Κατευθείαν στην αρχική
  function goHome() {
    const steps = depthRef.current;
    closeInner();
    setOpenSubject(null);
    if (steps > 0) window.history.go(-steps);
    window.scrollTo(0, 0);
  }

  function openSubjectPage(s) {
    setOpenSubject(s);
    pushLevel();
    window.scrollTo(0, 0);
  }

  // ---------- Κουίζ ----------

  const answer = useCallback(
    (index) => {
      if (picked !== null || !questions[current]) return;
      setPicked(index);
      const q = questions[current];
      const isCorrect = index >= 0 && q.choices[index].correct;
      setHistory((h) => [
        ...h,
        {
          question: q.question,
          chosen: index >= 0 ? q.choices[index].text : null,
          correct: q.choices.find((c) => c.correct).text,
          ok: isCorrect,
        },
      ]);
      if (isCorrect) {
        const elapsed = (Date.now() - questionStart.current) / 1000;
        const left = Math.max(0, secondsPerQuestion - elapsed);
        const gain = BASE_POINTS + Math.round((SPEED_POINTS * left) / secondsPerQuestion);
        setCorrectCount((c) => c + 1);
        setPoints((p) => p + gain);
        setLastGain(gain);
        playSound("correct", soundOn);
      } else {
        setLastGain(0);
        playSound("wrong", soundOn);
      }
    },
    [picked, questions, current, soundOn, secondsPerQuestion]
  );

  // Χρονόμετρο ερώτησης
  useEffect(() => {
    if (!subject || finished || picked !== null || questions.length === 0) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - questionStart.current) / 1000;
      const left = Math.max(0, secondsPerQuestion - elapsed);
      setTimeLeft(left);
      if (left <= 0) answer(-1);
    }, 100);
    return () => clearInterval(id);
  }, [subject, finished, picked, questions, current, answer, secondsPerQuestion]);

  function startQuestion(seconds) {
    questionStart.current = Date.now();
    setTimeLeft(seconds);
    setPicked(null);
    setLastGain(0);
  }

  async function loadQuestions(subj, m) {
    if (LEVELS[m]) return prepareQuestions(await fetchJson(`/lessons/${subj.id}/${m}.json`));
    const ch = chapterOf(subj, m);
    if (ch) return prepareQuestions(await fetchJson(`/lessons/${subj.id}/chapters/${ch.id}.json`));
    // Επανάληψη / Διαγώνισμα: ερωτήσεις από όλη την ύλη
    const files = [
      ...subj.chapters.map((c) => `/lessons/${subj.id}/chapters/${c.id}.json`),
      ...subj.levels.map(({ level: l }) => `/lessons/${subj.id}/${l}.json`),
    ];
    const all = await Promise.all(files.map(fetchJson));
    return prepareQuestions(all.flat()).slice(0, REVIEW_QUESTIONS);
  }

  function startQuiz(subj, m) {
    if (loading) return;
    setError("");
    setLoading(true);
    const alreadyInside = Boolean(subject || boardFor);
    loadQuestions(subj, m)
      .then((qs) => {
        if (!alreadyInside) pushLevel();
        setBoardFor(null);
        setSubject(subj);
        setMode(m);
        setQuestions(qs);
        setCurrent(0);
        setCorrectCount(0);
        setPoints(0);
        setHistory([]);
        setFinished(false);
        setBoard(null);
        setMyRank(0);
        startQuestion(m === "exam" ? SECONDS_PER_EXAM_QUESTION : SECONDS_PER_QUESTION);
        window.scrollTo(0, 0);
      })
      .catch(() => setError("Δεν φορτώθηκαν οι ερωτήσεις. Δοκίμασε ξανά."))
      .finally(() => setLoading(false));
  }

  function next() {
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      startQuestion(secondsPerQuestion);
      return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    const key = boardKey(subject, mode);
    if (best[key] === undefined || points > best[key]) {
      const updated = { ...best, [key]: points };
      setBest(updated);
      writeStorage(BEST_KEY, updated);
    }
    setFinished(true);
    window.scrollTo(0, 0);

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

  function openBoard(subj, m) {
    if (!boardFor && !subject) pushLevel();
    setBoardFor({ subject: subj, mode: m });
    setBoard(null);
    setMyRank(0);
    setBoardLoading(true);
    setBoardError("");
    fetchBoard(boardKey(subj, m))
      .then(setBoard)
      .catch(() => setBoardError("Η κατάταξη δεν είναι διαθέσιμη αυτή τη στιγμή."))
      .finally(() => setBoardLoading(false));
  }

  function bestText(subj, m) {
    const b = best[boardKey(subj, m)];
    return b !== undefined ? ` · ρεκόρ ${b} π.` : "";
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

  if (error && !groups) {
    return (
      <div className="page">
        {header}
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!groups) {
    return (
      <div className="page">
        {header}
        <p className="muted">Φόρτωση…</p>
      </div>
    );
  }

  // Κατάταξη
  if (boardFor) {
    const { subject: s, mode: m } = boardFor;
    return (
      <div className="page">
        {header}
        <h1>
          🏆 {icon(s)} {s.name}
        </h1>
        <p className="muted grade-line">{s.grade}</p>
        <label className="select-label" htmlFor="board-mode">
          Κατάταξη για:
        </label>
        <select
          id="board-mode"
          className="select"
          value={m}
          onChange={(e) => openBoard(s, e.target.value)}
        >
          {modesOf(s).map((x) => (
            <option key={x} value={x}>
              {modeEmoji(x)} {modeLabel(s, x)}
            </option>
          ))}
        </select>
        <div className="panel">
          <Leaderboard scores={board} loading={boardLoading} error={boardError} />
        </div>
        <div className="actions">
          <button className="primary" onClick={() => startQuiz(s, m)} disabled={loading}>
            Παίξε αυτό
          </button>
          <button className="secondary" onClick={back}>
            Πίσω
          </button>
        </div>
      </div>
    );
  }

  // Τέλος κουίζ
  if (subject && finished) {
    const percent = Math.round((correctCount / questions.length) * 100);
    const message =
      percent === 100
        ? "Τέλειο! 🏆"
        : percent >= 80
        ? "Μπράβο! 🎉"
        : percent >= 50
        ? "Καλή προσπάθεια! 👍"
        : "Συνέχισε την επανάληψη! 💪";
    const mistakes = history.filter((h) => !h.ok);
    const ch = chapterOf(subject, mode);
    const nextChapter = ch ? subject.chapters[subject.chapters.indexOf(ch) + 1] : null;
    return (
      <div className="page">
        {header}
        <div className="result">
          <h1>{message}</h1>
          {isExam ? (
            <>
              <div className="big">Βαθμός {gradeOf20(correctCount, questions.length)}/20</div>
              <p className="muted">
                {correctCount}/{questions.length} σωστές · {points} πόντοι
              </p>
            </>
          ) : (
            <>
              <div className="big">{points} πόντοι</div>
              <p className="muted">
                {correctCount}/{questions.length} σωστές ({percent}%)
              </p>
            </>
          )}
          <p className="muted">
            {subject.name} · {modeLabel(subject, mode)} · {subject.grade}
          </p>
          {myRank > 0 && <p className="rank">Είσαι στη θέση #{myRank} της κατάταξης! 🎉</p>}
          {!name.trim() && (
            <p className="muted">Γράψε όνομα στην αρχική για να μπαίνεις στην κατάταξη.</p>
          )}
          <div className="actions">
            <button className="primary" onClick={() => startQuiz(subject, mode)} disabled={loading}>
              Ξανά
            </button>
            {nextChapter && (
              <button
                className="primary"
                onClick={() => startQuiz(subject, `c${nextChapter.id}`)}
                disabled={loading}
              >
                Επόμενο κεφάλαιο →
              </button>
            )}
            <button className="secondary" onClick={back}>
              Πίσω στο μάθημα
            </button>
          </div>
        </div>

        <h2 className="board-title">
          {mistakes.length === 0
            ? "✅ Καμία λάθος απάντηση!"
            : `📒 Επανάληψη: τα λάθη σου (${mistakes.length})`}
        </h2>
        {mistakes.length > 0 && (
          <div className="panel review">
            {mistakes.map((m, i) => (
              <div className="review-item" key={i}>
                <div className="review-q">{m.question}</div>
                <div className="review-wrong">
                  ❌ {m.chosen === null ? "Δεν απάντησες (τέλος χρόνου)" : m.chosen}
                </div>
                <div className="review-right">✅ {m.correct}</div>
              </div>
            ))}
          </div>
        )}

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
  if (subject) {
    const q = questions[current];
    const progress = ((current + (picked !== null ? 1 : 0)) / questions.length) * 100;
    const timePercent = (timeLeft / secondsPerQuestion) * 100;
    const timeClass = timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "";

    return (
      <div className="page">
        {header}
        <div className="quiz-info">
          <span className="quiz-title">
            {icon(subject)} {subject.name} · {modeLabel(subject, mode)}
          </span>
          <span className="nowrap">
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

  // Οθόνη μαθήματος: κεφάλαια + επανάληψη όλης της ύλης
  if (openSubject) {
    const s = openSubject;
    const review = s.reviewMode;
    // ομαδοποίηση κεφαλαίων ανά ενότητα (αν το meta.json ορίζει «unit»)
    const units = [];
    s.chapters.forEach((c) => {
      const last = units[units.length - 1];
      if (last && last.unit === (c.unit || "")) last.items.push(c);
      else units.push({ unit: c.unit || "", items: [c] });
    });
    return (
      <div className="page">
        {header}
        <button className="link back-link" onClick={back}>
          ← Όλα τα μαθήματα
        </button>
        <h1>
          {icon(s)} {s.name}
        </h1>
        <p className="muted grade-line">
          {s.grade} · {s.total} ερωτήσεις
        </p>
        {error && <p className="error">{error}</p>}

        <button className="review-btn" onClick={() => startQuiz(s, review)} disabled={loading}>
          <span className="review-btn-title">
            {modeEmoji(review)} {modeLabel(s, review)}
          </span>
          <small>
            {REVIEW_QUESTIONS} τυχαίες ερωτήσεις από όλη την ύλη
            {review === "exam"
              ? `, ${SECONDS_PER_EXAM_QUESTION}″ η καθεμία, με βαθμό στα 20`
              : ""}
            {bestText(s, review)}
          </small>
        </button>

        {units.map((u, ui) => (
          <div key={ui}>
            {u.unit && <h2 className="unit-title">{u.unit}</h2>}
            {!u.unit && ui === 0 && <h2 className="unit-title">Κεφάλαια</h2>}
            <div className="chapters">
              {u.items.map((c) => (
                <button
                  key={c.id}
                  className="chapter"
                  onClick={() => startQuiz(s, `c${c.id}`)}
                  disabled={loading}
                >
                  <span className="chapter-num">{c.num}</span>
                  <span className="chapter-text">
                    <span>{c.title}</span>
                    <small>
                      {c.count} ερωτ.{bestText(s, `c${c.id}`)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {s.levels.length > 0 && (
          <>
            <h2 className="unit-title">
              {s.chapters.length > 0 ? "Γενικές ερωτήσεις" : "Ερωτήσεις ανά δυσκολία"}
            </h2>
            <div className="levels">
              {s.levels.map(({ level: lv, count }) => (
                <button
                  key={lv}
                  className={`level ${lv}`}
                  onClick={() => startQuiz(s, lv)}
                  disabled={loading}
                >
                  <span>
                    {LEVELS[lv].emoji} {LEVELS[lv].label}
                  </span>
                  <small>
                    {count} ερωτ.{bestText(s, lv)}
                  </small>
                </button>
              ))}
            </div>
            {s.chapters.length === 0 && (
              <p className="muted small-note">
                Τα κεφάλαια για αυτό το μάθημα θα προστεθούν σύντομα.
              </p>
            )}
          </>
        )}

        <div className="actions">
          <button className="secondary" onClick={() => openBoard(s, review)}>
            🏆 Κατάταξη
          </button>
          <button className="secondary" onClick={back}>
            Πίσω
          </button>
        </div>
      </div>
    );
  }

  // Αρχική
  const activeTab = Math.min(Math.max(0, Number(tab) || 0), groups.length - 1);
  const group = groups[activeTab];
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

      <h1>Διάλεξε τάξη</h1>
      <div className="tabs grade-tabs">
        {groups.map((g, i) => (
          <button
            key={g.title}
            className={`tab ${i === activeTab ? "active" : ""}`}
            onClick={() => setTab(i)}
          >
            {g.icon} {g.title}
          </button>
        ))}
      </div>

      <p className="muted rules">
        ⏱️ {SECONDS_PER_QUESTION}″ ανά ερώτηση · ✅ {BASE_POINTS} πόντοι για σωστή + έως{" "}
        {SPEED_POINTS} μπόνους ταχύτητας
      </p>
      {group.exam && (
        <div className="exam-note">
          📝 <b>{group.examTitle}:</b> {REVIEW_QUESTIONS} ερωτήσεις από όλη την ύλη του
          μαθήματος, {SECONDS_PER_EXAM_QUESTION}″ η καθεμία, με βαθμό στα 20 και λίστα με τα
          λάθη για επανάληψη.
        </div>
      )}

      <h2 className="unit-title">Διάλεξε μάθημα</h2>
      <div className="subjects">
        {group.subjects.map((s) => (
          <button className="subject" key={s.id} onClick={() => openSubjectPage(s)}>
            <span className="icon">{icon(s)}</span>
            <span className="subject-text">
              <span className="subject-name">{s.name}</span>
              <small className="muted">
                {s.chapters.length > 0
                  ? `${s.chapters.length} κεφάλαια · ${s.total} ερωτήσεις`
                  : `${s.total} ερωτήσεις`}
              </small>
            </span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
