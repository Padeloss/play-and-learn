import React, { useCallback, useEffect, useRef, useState } from "react";
import "../index.css";
import { playSound } from "../sounds";
import AdminPage from "./AdminPage";

// Τρόποι παιχνιδιού ("mode"):
//   easy | medium | hard  -> ερωτήσεις μιας δυσκολίας (μαθήματα χωρίς κεφάλαια)
//   c<id>                 -> ένα κεφάλαιο, π.χ. c07 ή c30a
//   all                   -> Επανάληψη όλης της ύλης (τυχαίες ερωτήσεις από όλο το μάθημα)
//   exam                  -> Διαγώνισμα (όπως το all, με περισσότερο χρόνο και βαθμό στα 20)
//
// Διευθύνσεις (κάθε οθόνη έχει δικό της link και αντέχει το refresh):
//   #/                          αρχική
//   #/m/<κλειδί>                οθόνη μαθήματος
//   #/m/<κλειδί>/play/<τρόπος>  κουίζ (π.χ. #/m/e535dba8/play/c07)
//   #/m/<κλειδί>/board/<τρόπος> κατάταξη
//   #/admin                     κρυφή σελίδα διαχείρισης της κατάταξης
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

// Επιλογές χρόνου. Το μπόνους ταχύτητας μετριέται ΠΑΝΤΑ με τον κανονικό χρόνο,
// ώστε η κατάταξη να είναι δίκαιη: με περισσότερο χρόνο ή χωρίς χρόνο δεν χάνεις
// την ερώτηση, αλλά το μπόνους είναι το ίδιο με όλους.
const TIME_OPTIONS = {
  normal: { label: "Κανονικός", factor: 1 },
  extra: { label: "Διπλάσιος", factor: 2 },
  off: { label: "Χωρίς όριο", factor: Infinity },
};

const BEST_KEY = "playandlearn-best-v3";
const NAME_KEY = "playandlearn-name";
const SOUND_KEY = "playandlearn-sound";
const TAB_KEY = "playandlearn-tab";
const TIME_KEY = "playandlearn-time";

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

// Emoji μόνο για εμφάνιση — ο αναγνώστης οθόνης δεν τα διαβάζει
function Icon({ children }) {
  return (
    <span className="emoji" aria-hidden="true">
      {children}
    </span>
  );
}

function iconOf(subject) {
  return ICONS[subject.name] || "📘";
}

function chapterOf(subject, mode) {
  if (!mode || mode[0] !== "c") return null;
  return subject.chapters.find((c) => `c${c.id}` === mode) || null;
}

function isValidMode(subject, mode) {
  if (mode === subject.reviewMode) return true;
  if (LEVELS[mode]) return subject.levels.some((l) => l.level === mode);
  return Boolean(chapterOf(subject, mode));
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

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error();
  return r.json();
}

async function fetchBoard(key) {
  const data = await fetchJson(`/api/scores?key=${encodeURIComponent(key)}`);
  return data.scores || [];
}

// ---------- Διευθύνσεις (hash) ----------

function parseHash(hash) {
  const parts = String(hash || "")
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
  if (parts[0] === "admin") return { screen: "admin" };
  if (parts[0] !== "m" || !parts[1]) return { screen: "home" };
  const key = parts[1];
  if ((parts[2] === "play" || parts[2] === "board") && parts[3]) {
    return { screen: parts[2], key, mode: parts[3] };
  }
  return { screen: "subject", key };
}

function hashOf(route) {
  if (route.screen === "home") return "#/";
  if (route.screen === "admin") return "#/admin";
  if (route.screen === "subject") return `#/m/${route.key}`;
  return `#/m/${route.key}/${route.screen}/${route.mode}`;
}

// Η οθόνη «από πάνω»: κουίζ/κατάταξη -> μάθημα -> αρχική
function parentOf(route) {
  if (route.screen === "play" || route.screen === "board") {
    return { screen: "subject", key: route.key };
  }
  return { screen: "home" };
}

function sameRoute(a, b) {
  return hashOf(a) === hashOf(b);
}

// ---------- Πίνακας κατάταξης ----------

function Leaderboard({ scores, loading, error, highlight }) {
  if (loading) return <p className="muted">Φόρτωση κατάταξης…</p>;
  if (error) return <p className="muted">{error}</p>;
  if (!scores || scores.length === 0) {
    return <p className="muted">Δεν υπάρχει ακόμα κανένα σκορ. Γίνε ο πρώτος!</p>;
  }
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <ol className="board">
      {scores.map((s, i) => (
        <li key={`${s.time}-${i}`} className={highlight === i + 1 ? "me" : ""}>
          <span className="pos">
            {medals[i] ? (
              <>
                <Icon>{medals[i]}</Icon>
                <span className="sr-only">{i + 1}η θέση</span>
              </>
            ) : (
              i + 1
            )}
          </span>
          <span className="who">{s.name}</span>
          <span className="pts">
            {s.points} π. <small>({s.correct}/{s.total})</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

// ---------- Παράθυρο επιβεβαίωσης εξόδου από το κουίζ ----------

function LeaveDialog({ open, isExam, onStay, onLeave }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
    if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="leave-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc = μένω
        onStay();
      }}
    >
      <h2 id="leave-title">Να βγεις από {isExam ? "το διαγώνισμα" : "το κουίζ"};</h2>
      <p>Η πρόοδός σου θα χαθεί και το σκορ δεν θα μπει στην κατάταξη.</p>
      <div className="actions dialog-actions">
        <button className="primary" onClick={onStay} autoFocus>
          Συνέχισε το κουίζ
        </button>
        <button className="secondary" onClick={onLeave}>
          Έξοδος
        </button>
      </div>
    </dialog>
  );
}

// ---------- Εφαρμογή ----------

function App() {
  const [groups, setGroups] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState(() => readStorage(TAB_KEY, 0));
  const [name, setName] = useState(() => readStorage(NAME_KEY, ""));
  const [soundOn, setSoundOn] = useState(() => readStorage(SOUND_KEY, true));
  const [timeMode, setTimeMode] = useState(() => {
    const t = readStorage(TIME_KEY, "normal");
    return TIME_OPTIONS[t] ? t : "normal";
  });
  const [best, setBest] = useState(() => readStorage(BEST_KEY, {}));
  const [nameBlocked, setNameBlocked] = useState(false); // το όνομα δεν επιτρέπεται στην κατάταξη
  const [nameError, setNameError] = useState("");

  // ποια οθόνη δείχνουμε — διαβάζεται από τη διεύθυνση
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const [leaveTarget, setLeaveTarget] = useState(null); // πού θέλει να πάει όταν ρωτάμε «να βγεις;»

  // κουίζ
  const [quiz, setQuiz] = useState(null); // { key, mode, questions } ή null
  const [quizError, setQuizError] = useState("");
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState(null); // index, ή -1 αν τελείωσε ο χρόνος
  const [correctCount, setCorrectCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [finished, setFinished] = useState(false);
  const [history, setHistory] = useState([]); // για την επανάληψη των λαθών

  // κατάταξη
  const [board, setBoard] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [myRank, setMyRank] = useState(0);

  const questionStart = useRef(0);
  const questionHeading = useRef(null);
  const nextButton = useRef(null);

  // Βρες το μάθημα από το κλειδί της διεύθυνσης
  const findSubject = useCallback(
    (key) => {
      if (!groups || !key) return null;
      for (const g of groups) {
        const s = g.subjects.find((x) => x.key === key);
        if (s) return s;
      }
      return null;
    },
    [groups]
  );

  const subject = route.screen === "home" || route.screen === "admin" ? null : findSubject(route.key);
  const isExam = route.mode === "exam";
  const baseSeconds = isExam ? SECONDS_PER_EXAM_QUESTION : SECONDS_PER_QUESTION;
  const limitSeconds = baseSeconds * TIME_OPTIONS[timeMode].factor;
  const quizReady =
    route.screen === "play" && quiz && quiz.key === route.key && quiz.mode === route.mode;
  // Το κουίζ «κρατάει» πρόοδο που θα χαθεί αν φύγει ο παίκτης
  const inProgress = Boolean(quizReady && !finished && (current > 0 || picked !== null));
  const inProgressRef = useRef(false);
  inProgressRef.current = inProgress;
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    fetchJson("/lessons/index.json")
      .then((data) => {
        // κάθε μάθημα «ξέρει» αν η τάξη του έχει διαγώνισμα, και ποιο θέμα ήχων έχει
        const withFlags = data.map((g) => ({
          ...g,
          subjects: g.subjects.map((s) => ({
            ...s,
            examTitle: g.examTitle,
            reviewMode: g.exam ? "exam" : "all",
            sound: g.sound || "kids",
          })),
        }));
        setGroups(withFlags);
      })
      .catch(() => setLoadError("Δεν φορτώθηκαν τα μαθήματα. Έλεγξε τη σύνδεση και δοκίμασε ξανά."));
  }, []);

  useEffect(() => writeStorage(NAME_KEY, name), [name]);

  // Έλεγχος ονόματος στον server (ίδια λίστα με αυτή που ελέγχει την κατάταξη)
  const checkName = useCallback((value) => {
    const n = String(value || "").trim();
    if (!n) {
      setNameBlocked(false);
      setNameError("");
      return;
    }
    fetchJson(`/api/scores?checkName=${encodeURIComponent(n)}`)
      .then((d) => {
        setNameBlocked(!d.ok);
        setNameError(d.ok ? "" : "Αυτό το όνομα δεν επιτρέπεται. Γράψε το μικρό σου όνομα ή ένα ευγενικό παρατσούκλι.");
      })
      .catch(() => {
        /* αν δεν απαντά ο server, ο έλεγχος γίνεται ξανά στην αποθήκευση του σκορ */
      });
  }, []);
  useEffect(() => {
    checkName(readStorage(NAME_KEY, ""));
  }, [checkName]);
  useEffect(() => writeStorage(SOUND_KEY, soundOn), [soundOn]);
  useEffect(() => writeStorage(TAB_KEY, tab), [tab]);
  useEffect(() => writeStorage(TIME_KEY, timeMode), [timeMode]);

  // ---------- Πλοήγηση ----------

  // Πήγαινε σε μια οθόνη (νέα εγγραφή στο ιστορικό, ή αντικατάσταση)
  const go = useCallback((target, { replace = false } = {}) => {
    const from = hashOf(routeRef.current);
    const state = { pal: true, prev: replace ? (window.history.state || {}).prev : from };
    try {
      if (replace) window.history.replaceState(state, "", hashOf(target));
      else window.history.pushState(state, "", hashOf(target));
    } catch {
      window.location.hash = hashOf(target);
    }
    setRoute(target);
    window.scrollTo(0, 0);
  }, []);

  // Ζητά να πάει κάπου — αν το κουίζ έχει πρόοδο, ρωτάει πρώτα
  const requestGo = useCallback(
    (target, options) => {
      if (inProgressRef.current && !sameRoute(target, routeRef.current)) {
        setLeaveTarget({ target, options });
        return;
      }
      go(target, options);
    },
    [go]
  );

  // Ένα επίπεδο πάνω. Αν ήρθαμε από εκεί, γυρνάμε στο ιστορικό (σαν το «πίσω» του κινητού).
  function up() {
    const target = parentOf(route);
    const prev = (window.history.state || {}).prev;
    if (prev === hashOf(target)) {
      if (inProgressRef.current) {
        setLeaveTarget({ target, options: { back: true } });
        return;
      }
      window.history.back();
      return;
    }
    requestGo(target, { replace: true });
  }

  function goHome() {
    requestGo({ screen: "home" });
  }

  // Κουμπί «πίσω» του browser / κινητού
  useEffect(() => {
    function onPop() {
      const target = parseHash(window.location.hash);
      if (inProgressRef.current && !sameRoute(target, routeRef.current)) {
        // ξαναβάζουμε το κουίζ στη διεύθυνση και ρωτάμε
        const here = routeRef.current;
        try {
          window.history.pushState({ pal: true, prev: hashOf(target) }, "", hashOf(here));
        } catch {
          /* δεν πειράζει */
        }
        setLeaveTarget({ target, options: { replace: true } });
        return;
      }
      setRoute(target);
      window.scrollTo(0, 0);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function confirmLeave() {
    const { target, options = {} } = leaveTarget;
    setLeaveTarget(null);
    setQuiz(null);
    inProgressRef.current = false;
    if (options.back) window.history.back();
    else go(target, options);
  }

  // ---------- Κουίζ ----------

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

  function startQuestion() {
    questionStart.current = Date.now();
    setTimeLeft(limitSeconds);
    setPicked(null);
    setLastGain(0);
  }

  // Ξεκίνα κουίζ όταν η διεύθυνση δείχνει «play» (και μετά από refresh ή link)
  const playKey = route.screen === "play" && subject ? `${route.key}/${route.mode}` : "";
  const [restart, setRestart] = useState(0);
  useEffect(() => {
    if (!playKey) {
      setQuiz(null);
      return;
    }
    const [key, m] = playKey.split("/");
    const subj = findSubject(key);
    if (!subj || !isValidMode(subj, m)) return;
    let cancelled = false;
    setQuiz(null);
    setQuizError("");
    loadQuestions(subj, m)
      .then((qs) => {
        if (cancelled) return;
        setQuiz({ key, mode: m, questions: qs });
        setCurrent(0);
        setCorrectCount(0);
        setPoints(0);
        setHistory([]);
        setFinished(false);
        setBoard(null);
        setMyRank(0);
        questionStart.current = Date.now();
        setPicked(null);
        setLastGain(0);
        window.scrollTo(0, 0);
      })
      .catch(() => !cancelled && setQuizError("Δεν φορτώθηκαν οι ερωτήσεις. Έλεγξε τη σύνδεση και δοκίμασε ξανά."));
    return () => {
      cancelled = true;
    };
  }, [playKey, restart]);

  // Ο χρόνος ξεκινά από την αρχή σε κάθε νέα ερώτηση
  useEffect(() => {
    if (quizReady) setTimeLeft(limitSeconds);
  }, [quizReady, current]);

  // Μετακίνησε την εστίαση στην ερώτηση (για πληκτρολόγιο και αναγνώστη οθόνης)
  useEffect(() => {
    if (quizReady && !finished && questionHeading.current) questionHeading.current.focus();
  }, [quizReady, current, finished]);

  const questions = quizReady ? quiz.questions : [];

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
        const left = Math.max(0, baseSeconds - elapsed);
        const gain = BASE_POINTS + Math.round((SPEED_POINTS * left) / baseSeconds);
        setCorrectCount((c) => c + 1);
        setPoints((p) => p + gain);
        setLastGain(gain);
        playSound("correct", subject && subject.sound, soundOn);
      } else {
        setLastGain(0);
        playSound("wrong", subject && subject.sound, soundOn);
      }
      setTimeout(() => nextButton.current && nextButton.current.focus(), 0);
    },
    [picked, questions, current, soundOn, baseSeconds, subject]
  );

  // Χρονόμετρο ερώτησης (δεν τρέχει με «Χωρίς όριο»)
  useEffect(() => {
    if (!quizReady || finished || picked !== null || !Number.isFinite(limitSeconds)) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - questionStart.current) / 1000;
      const left = Math.max(0, limitSeconds - elapsed);
      setTimeLeft(left);
      if (left <= 0) answer(-1);
    }, 100);
    return () => clearInterval(id);
  }, [quizReady, finished, picked, current, answer, limitSeconds]);

  function next() {
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      startQuestion();
      return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    const key = boardKey(subject, route.mode);
    if (best[key] === undefined || points > best[key]) {
      const updated = { ...best, [key]: points };
      setBest(updated);
      writeStorage(BEST_KEY, updated);
    }
    setFinished(true);
    playSound("finish", subject.sound, soundOn);
    window.scrollTo(0, 0);

    setBoardLoading(true);
    setBoardError("");
    const player = nameBlocked ? "" : name.trim();
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
          if (r.status === 400) {
            const data = await r.json().catch(() => ({}));
            if (data.code === "name") {
              setNameBlocked(true);
              setNameError(data.error);
              setBoardError(data.error);
              return fetchBoard(key);
            }
          }
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

  function playAgain() {
    if (quizReady && !finished) return;
    setRestart((n) => n + 1);
  }

  // Κατάταξη: φόρτωσε όταν η διεύθυνση δείχνει «board»
  const boardRouteKey = route.screen === "board" && subject ? `${route.key}-${route.mode}` : "";
  useEffect(() => {
    if (!boardRouteKey) return;
    setBoard(null);
    setMyRank(0);
    setBoardLoading(true);
    setBoardError("");
    let cancelled = false;
    fetchBoard(boardRouteKey)
      .then((b) => !cancelled && setBoard(b))
      .catch(() => !cancelled && setBoardError("Η κατάταξη δεν είναι διαθέσιμη αυτή τη στιγμή."))
      .finally(() => !cancelled && setBoardLoading(false));
    return () => {
      cancelled = true;
    };
  }, [boardRouteKey]);

  function bestText(subj, m) {
    const b = best[boardKey(subj, m)];
    return b !== undefined ? ` · ρεκόρ ${b} π.` : "";
  }

  // ---------- Οθόνες ----------

  const header = (
    <header className="top">
      <button className="logo" onClick={goHome}>
        <Icon>🎮</Icon> Play and Learn
      </button>
      <button
        className="icon-btn"
        onClick={() => setSoundOn(!soundOn)}
        aria-pressed={soundOn}
        aria-label="Ήχος"
        title={soundOn ? "Σίγαση ήχου" : "Ενεργοποίηση ήχου"}
      >
        <Icon>{soundOn ? "🔊" : "🔇"}</Icon>
      </button>
    </header>
  );

  const dialog = (
    <LeaveDialog
      open={Boolean(leaveTarget)}
      isExam={isExam}
      onStay={() => setLeaveTarget(null)}
      onLeave={confirmLeave}
    />
  );

  function page(children) {
    return (
      <div className="page">
        {header}
        <main>{children}</main>
        {dialog}
      </div>
    );
  }

  if (loadError && !groups) {
    return page(
      <>
        <h1>Κάτι πήγε στραβά</h1>
        <p className="error" role="alert">
          {loadError}
        </p>
        <button className="primary" onClick={() => window.location.reload()}>
          Δοκίμασε ξανά
        </button>
      </>
    );
  }

  if (!groups) {
    return page(<p className="muted">Φόρτωση…</p>);
  }

  // Κρυφή σελίδα διαχείρισης
  if (route.screen === "admin") {
    const describeKey = (k) => {
      const [base, m] = String(k).split("-");
      const s = groups.flatMap((g) => g.subjects).find((x) => x.key === base);
      if (!s) return `παλιό σκορ (${k})`;
      return `${s.grade} · ${s.name} · ${isValidMode(s, m) ? modeLabel(s, m) : m}`;
    };
    return page(<AdminPage describeKey={describeKey} onBack={() => go({ screen: "home" })} />);
  }

  // Λάθος ή παλιό link
  if (route.screen !== "home" && (!subject || (route.mode && !isValidMode(subject, route.mode)))) {
    return page(
      <>
        <h1>Δεν βρέθηκε</h1>
        <p className="muted">
          Αυτό το μάθημα ή κεφάλαιο δεν υπάρχει (ίσως άλλαξε η εφαρμογή). Διάλεξε από την αρχή.
        </p>
        <button className="primary" onClick={() => go({ screen: "home" }, { replace: true })}>
          Στην αρχική
        </button>
      </>
    );
  }

  // Κατάταξη
  if (route.screen === "board") {
    const s = subject;
    const m = route.mode;
    return page(
      <>
        <button className="link back-link" onClick={up}>
          ← {s.name}
        </button>
        <h1>
          <Icon>🏆</Icon> Κατάταξη · {s.name}
        </h1>
        <p className="muted grade-line">{s.grade}</p>
        <label className="select-label" htmlFor="board-mode">
          Κατάταξη για:
        </label>
        <select
          id="board-mode"
          className="select"
          value={m}
          onChange={(e) => go({ screen: "board", key: s.key, mode: e.target.value }, { replace: true })}
        >
          {modesOf(s).map((x) => (
            <option key={x} value={x}>
              {modeLabel(s, x)}
            </option>
          ))}
        </select>
        <div className="panel">
          <Leaderboard scores={board} loading={boardLoading} error={boardError} />
        </div>
        <div className="actions">
          <button className="primary" onClick={() => go({ screen: "play", key: s.key, mode: m })}>
            Παίξε αυτό
          </button>
          <button className="secondary" onClick={up}>
            Πίσω
          </button>
        </div>
      </>
    );
  }

  // Κουίζ: φόρτωση ή σφάλμα
  if (route.screen === "play" && !quizReady) {
    return page(
      <>
        <button className="link back-link" onClick={up}>
          ← {subject.name}
        </button>
        <h1>{modeLabel(subject, route.mode)}</h1>
        {quizError ? (
          <>
            <p className="error" role="alert">
              {quizError}
            </p>
            <div className="actions">
              <button className="primary" onClick={() => setRestart((n) => n + 1)}>
                Δοκίμασε ξανά
              </button>
              <button className="secondary" onClick={up}>
                Πίσω
              </button>
            </div>
          </>
        ) : (
          <p className="muted" role="status">
            Φόρτωση ερωτήσεων…
          </p>
        )}
      </>
    );
  }

  // Τέλος κουίζ
  if (route.screen === "play" && finished) {
    const percent = Math.round((correctCount / questions.length) * 100);
    const message =
      percent === 100
        ? "Τέλειο!"
        : percent >= 80
        ? "Μπράβο!"
        : percent >= 50
        ? "Καλή προσπάθεια!"
        : "Συνέχισε την επανάληψη!";
    const mistakes = history.filter((h) => !h.ok);
    const ch = chapterOf(subject, route.mode);
    const nextChapter = ch ? subject.chapters[subject.chapters.indexOf(ch) + 1] : null;
    return page(
      <>
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
            {subject.name} · {modeLabel(subject, route.mode)} · {subject.grade}
          </p>
          {myRank > 0 && <p className="rank">Είσαι στη θέση #{myRank} της κατάταξης!</p>}
          {!name.trim() && (
            <p className="muted">Γράψε όνομα στην αρχική για να μπαίνεις στην κατάταξη.</p>
          )}
          {name.trim() && nameBlocked && (
            <p className="error" role="alert">
              Το σκορ δεν μπήκε στην κατάταξη, γιατί το όνομα δεν επιτρέπεται. Άλλαξέ το στην αρχική.
            </p>
          )}
          <div className="actions">
            {nextChapter && (
              <button
                className="primary"
                onClick={() =>
                  go({ screen: "play", key: subject.key, mode: `c${nextChapter.id}` }, { replace: true })
                }
              >
                Επόμενο κεφάλαιο →
              </button>
            )}
            <button className={nextChapter ? "secondary" : "primary"} onClick={playAgain}>
              Ξανά
            </button>
            <button className="secondary" onClick={up}>
              Πίσω στο μάθημα
            </button>
          </div>
        </div>

        <h2 className="board-title">
          {mistakes.length === 0
            ? "Καμία λάθος απάντηση!"
            : `Επανάληψη: τα λάθη σου (${mistakes.length})`}
        </h2>
        {mistakes.length > 0 && (
          <div className="panel review">
            {mistakes.map((m, i) => (
              <div className="review-item" key={i}>
                <div className="review-q">{m.question}</div>
                <div className="review-wrong">
                  <Icon>❌</Icon> <span className="sr-only">Η απάντησή σου:</span>{" "}
                  {m.chosen === null ? "Δεν απάντησες (τέλος χρόνου)" : m.chosen}
                </div>
                <div className="review-right">
                  <Icon>✅</Icon> <span className="sr-only">Σωστή απάντηση:</span> {m.correct}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="board-title">Κατάταξη — top 10</h2>
        <div className="panel">
          <Leaderboard scores={board} loading={boardLoading} error={boardError} highlight={myRank} />
        </div>
      </>
    );
  }

  // Ερώτηση
  if (route.screen === "play") {
    const q = questions[current];
    const progress = ((current + (picked !== null ? 1 : 0)) / questions.length) * 100;
    const timed = Number.isFinite(limitSeconds);
    const timePercent = timed ? (timeLeft / limitSeconds) * 100 : 100;
    const timeClass = !timed ? "off" : timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "";
    const correctText = q.choices.find((c) => c.correct).text;
    const wrong = picked !== null && (picked === -1 || !q.choices[picked].correct);

    return page(
      <>
        <div className="quiz-info">
          <button className="link back-link" onClick={up}>
            ← {subject.name}
          </button>
          <span className="nowrap">
            {current + 1}/{questions.length} · <b>{points} π.</b>
          </span>
        </div>
        <p className="quiz-title">
          <Icon>{iconOf(subject)}</Icon> {modeLabel(subject, route.mode)}
        </p>
        <div
          className="bar"
          role="progressbar"
          aria-label="Πρόοδος"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={current + (picked !== null ? 1 : 0)}
        >
          <div className="bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className={`timer ${timeClass}`}>
          <div className="timer-fill" style={{ width: `${timePercent}%` }} />
          <span>
            <Icon>⏱️</Icon> {timed ? `${Math.ceil(timeLeft)}″` : "Χωρίς όριο χρόνου"}
          </span>
        </div>

        <h1 className="question" ref={questionHeading} tabIndex={-1}>
          {q.question}
        </h1>

        <div className="choices">
          {q.choices.map((c, i) => {
            let cls = "choice";
            if (picked !== null) {
              if (c.correct) cls += " correct";
              else if (i === picked) cls += " wrong";
              else cls += " faded";
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => answer(i)}
                aria-disabled={picked !== null}
              >
                {picked !== null && c.correct && <span className="sr-only">Σωστή απάντηση: </span>}
                {picked !== null && i === picked && !c.correct && (
                  <span className="sr-only">Η απάντησή σου, λάθος: </span>
                )}
                {c.text}
              </button>
            );
          })}
        </div>

        <div className="feedback">
          <span role="status" aria-live="polite" className="feedback-text">
            {picked === null
              ? ""
              : picked === -1
              ? "Τέλος χρόνου!"
              : wrong
              ? "Λάθος"
              : `Σωστό! +${lastGain}`}
            {wrong && <span className="sr-only">. Η σωστή απάντηση είναι: {correctText}</span>}
          </span>
          {picked !== null && (
            <button className="primary" onClick={next} ref={nextButton}>
              {current + 1 < questions.length ? "Επόμενη →" : "Αποτέλεσμα"}
            </button>
          )}
        </div>
      </>
    );
  }

  // Οθόνη μαθήματος: κεφάλαια + επανάληψη όλης της ύλης
  if (route.screen === "subject") {
    const s = subject;
    const review = s.reviewMode;
    // ομαδοποίηση κεφαλαίων ανά ενότητα (αν το meta.json ορίζει «unit»)
    const units = [];
    s.chapters.forEach((c) => {
      const last = units[units.length - 1];
      if (last && last.unit === (c.unit || "")) last.items.push(c);
      else units.push({ unit: c.unit || "", items: [c] });
    });
    const play = (m) => go({ screen: "play", key: s.key, mode: m });
    return page(
      <>
        <button className="link back-link" onClick={up}>
          ← Όλα τα μαθήματα
        </button>
        <h1>
          <Icon>{iconOf(s)}</Icon> {s.name}
        </h1>
        <p className="muted grade-line">
          {s.grade} · {s.total} ερωτήσεις
        </p>

        <button className="review-btn" onClick={() => play(review)}>
          <span className="review-btn-title">
            <Icon>{modeEmoji(review)}</Icon> {modeLabel(s, review)}
          </span>
          <small>
            {REVIEW_QUESTIONS} τυχαίες ερωτήσεις από όλη την ύλη
            {review === "exam" ? `, ${SECONDS_PER_EXAM_QUESTION}″ η καθεμία, με βαθμό στα 20` : ""}
            {bestText(s, review)}
          </small>
        </button>

        {units.map((u, ui) => (
          <section key={ui} aria-label={u.unit || "Κεφάλαια"}>
            {u.unit && <h2 className="unit-title">{u.unit}</h2>}
            {!u.unit && ui === 0 && <h2 className="unit-title">Κεφάλαια</h2>}
            <div className="chapters">
              {u.items.map((c) => (
                <button key={c.id} className="chapter" onClick={() => play(`c${c.id}`)}>
                  <span className="chapter-num" aria-hidden="true">
                    {c.num}
                  </span>
                  <span className="chapter-text">
                    <span>
                      <span className="sr-only">Κεφάλαιο {c.num}: </span>
                      {c.title}
                    </span>
                    <small>
                      {c.count} ερωτ.{bestText(s, `c${c.id}`)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {s.levels.length > 0 && (
          <section aria-label="Ερωτήσεις ανά δυσκολία">
            <h2 className="unit-title">
              {s.chapters.length > 0 ? "Γενικές ερωτήσεις" : "Ερωτήσεις ανά δυσκολία"}
            </h2>
            <div className="levels">
              {s.levels.map(({ level: lv, count }) => (
                <button key={lv} className={`level ${lv}`} onClick={() => play(lv)}>
                  <span>
                    <Icon>{LEVELS[lv].emoji}</Icon> {LEVELS[lv].label}
                  </span>
                  <small>
                    {count} ερωτ.{bestText(s, lv)}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="actions">
          <button className="secondary" onClick={() => go({ screen: "board", key: s.key, mode: review })}>
            <Icon>🏆</Icon> Κατάταξη
          </button>
          <button className="secondary" onClick={up}>
            Πίσω
          </button>
        </div>
      </>
    );
  }

  // Αρχική
  const activeTab = Math.min(Math.max(0, Number(tab) || 0), groups.length - 1);
  const group = groups[activeTab];
  return page(
    <>
      <h1 className="sr-only">Play and Learn — κουίζ για μαθητές</h1>
      <div className="panel name-panel">
        <label htmlFor="player">Το όνομά σου (για την κατάταξη)</label>
        <input
          id="player"
          value={name}
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
          placeholder="π.χ. Νίκος Π."
          aria-describedby={nameError ? "player-error player-help" : "player-help"}
          aria-invalid={nameBlocked}
          onChange={(e) => {
            setName(e.target.value);
            if (nameBlocked) {
              setNameBlocked(false);
              setNameError("");
            }
          }}
          onBlur={(e) => checkName(e.target.value)}
        />
        {nameError && (
          <p className="field-error" id="player-error" role="alert">
            {nameError}
          </p>
        )}
        <small className="muted" id="player-help">
          Αν το αφήσεις κενό, παίζεις κανονικά αλλά δεν μπαίνεις στην κατάταξη. Γράψε μόνο μικρό
          όνομα ή παρατσούκλι — φαίνεται σε όλους.
        </small>

        <fieldset className="time-choice">
          <legend>Χρόνος ανά ερώτηση</legend>
          <div className="segmented">
            {Object.entries(TIME_OPTIONS).map(([k, opt]) => (
              <label key={k} className={timeMode === k ? "on" : ""}>
                <input
                  type="radio"
                  name="time"
                  value={k}
                  checked={timeMode === k}
                  onChange={() => setTimeMode(k)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <small className="muted">
            {timeMode === "normal"
              ? `${SECONDS_PER_QUESTION}″ ανά ερώτηση (${SECONDS_PER_EXAM_QUESTION}″ στο διαγώνισμα).`
              : timeMode === "extra"
              ? `${SECONDS_PER_QUESTION * 2}″ ανά ερώτηση (${SECONDS_PER_EXAM_QUESTION * 2}″ στο διαγώνισμα).`
              : "Χωρίς χρονόμετρο — παίρνεις όσο χρόνο χρειάζεσαι."}{" "}
            Το μπόνους ταχύτητας είναι ίδιο για όλους.
          </small>
        </fieldset>
      </div>

      <h2 className="section-title">Διάλεξε τάξη</h2>
      <div className="tabs grade-tabs" role="group" aria-label="Τάξη">
        {groups.map((g, i) => (
          <button
            key={g.title}
            className={`tab ${i === activeTab ? "active" : ""}`}
            aria-pressed={i === activeTab}
            onClick={() => setTab(i)}
          >
            <Icon>{g.icon}</Icon> {g.title}
          </button>
        ))}
      </div>

      <p className="muted rules">
        {BASE_POINTS} πόντοι για σωστή απάντηση + έως {SPEED_POINTS} μπόνους ταχύτητας
      </p>
      {group.exam && (
        <div className="exam-note">
          <b>{group.examTitle}:</b> {REVIEW_QUESTIONS} ερωτήσεις από όλη την ύλη του μαθήματος,{" "}
          {SECONDS_PER_EXAM_QUESTION}″ η καθεμία, με βαθμό στα 20 και λίστα με τα λάθη για
          επανάληψη.
        </div>
      )}

      <h2 className="unit-title">Διάλεξε μάθημα</h2>
      <div className="subjects">
        {group.subjects.map((s) => (
          <button
            className="subject"
            key={s.id}
            onClick={() => go({ screen: "subject", key: s.key })}
          >
            <span className="icon" aria-hidden="true">
              {iconOf(s)}
            </span>
            <span className="subject-text">
              <span className="subject-name">{s.name}</span>
              <small className="muted">
                {s.chapters.length > 0
                  ? `${s.chapters.length} κεφάλαια · ${s.total} ερωτήσεις`
                  : `${s.total} ερωτήσεις`}
              </small>
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export default App;
