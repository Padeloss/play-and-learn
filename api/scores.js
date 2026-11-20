// Πίνακας κατάταξης και σκορ παικτών για το Play and Learn — έκδοση «οικονομική» (v2).
//
// Στόχος: να μένουμε στο ΔΩΡΕΑΝ πακέτο του Vercel Blob (2.000 «προχωρημένες» κινήσεις τον μήνα:
// put / list / copy). Γι' αυτό:
//   • ΔΕΝ γίνεται ποτέ list() στο κανονικό παιχνίδι.
//   • Κάθε κατάταξη είναι ΕΝΑ αρχείο:   lb/<κλειδί>.json   (οι 30 καλύτεροι, ένας ανά παίκτη)
//   • Κάθε παίκτης είναι ΕΝΑ αρχείο:    pl/<όνομα σε hex>.json (κωδικός, συσκευές, ρεκόρ ανά κεφάλαιο)
//   • Γράφουμε (put) ΜΟΝΟ όταν αλλάζει κάτι: νέο όνομα, νέο ρεκόρ του παίκτη, ή μπαίνει στην κατάταξη.
//     Ένα παιχνίδι χωρίς νέο ρεκόρ κοστίζει 0 προχωρημένες κινήσεις.
//   • Η ανάγνωση γίνεται με το δημόσιο URL του αρχείου (απλή κίνηση, και συνήθως από την cache = δωρεάν).
//
// GET  /api/scores?key=<κλειδί>                 -> { scores } οι 10 καλύτεροι
// GET  /api/scores?checkName=Νίκος&token=…       -> { ok, status: free | mine | taken | blocked }
// GET  /api/scores?player=Νίκος&token=…          -> { scores: [{ key, best, correct, total, time }] }
// POST /api/scores { key, name, token, points, correct, total } -> { scores, rank, pin? }
// POST /api/scores { action: "claim", name, token, pin }        -> «είμαι εγώ» σε άλλη συσκευή
//
// Διαχείριση (#/admin, header x-admin-key = ADMIN_KEY):
// GET    /api/scores?admin=1            -> όλα τα ρεκόρ όλων των παικτών + λίστα ονομάτων
// DELETE /api/scores { url }            -> σβήνει ένα ρεκόρ (url = "<κλειδί>|<όνομα>")
// DELETE /api/scores { player }         -> ξεκλειδώνει ένα όνομα (κρατά τα σκορ του)
//
// Τα παλιά δεδομένα (φάκελοι scores/ και players/) μεταφέρονται αυτόματα ΜΙΑ φορά στη νέα μορφή.
const crypto = require("crypto");
const { put, list, head, BlobNotFoundError } = require("@vercel/blob");
const { isBlockedName } = require("./_lib/nameFilter");

const KEY_RE = /^[a-f0-9]{8}-(easy|medium|hard|exam|all|c[0-9a-z]{1,6})$/;
const TOKEN_RE = /^[A-Za-z0-9-]{16,64}$/;
const MAX_POINTS_PER_QUESTION = 200;
const TOP = 10; // όσοι φαίνονται
const KEEP = 30; // όσοι κρατιούνται στο αρχείο (για να μένουν 10 αν σβηστεί κάποιος)
const META = "meta/v2.json";

// ---------- Βοηθητικά ----------

const toHex = (t) => Buffer.from(t, "utf8").toString("hex");
const fromHex = (t) => {
  try {
    return Buffer.from(t, "hex").toString("utf8");
  } catch {
    return "?";
  }
};
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 40);

function cleanName(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

// Ίδιο όνομα με άλλη γραφή (κεφαλαία, τόνοι, τελικό σ) = ίδιος παίκτης
function normName(raw) {
  return cleanName(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

const tokenHash = (norm, token) => hash(`t:${norm}:${token}`);
const pinHash = (norm, pin) => hash(`p:${norm}:${pin}`);
const playerPath = (norm) => `pl/${toHex(norm)}.json`;
const boardPath = (key) => `lb/${key}.json`;

function isAdmin(req) {
  const expected = process.env.ADMIN_KEY || "";
  const given = String(req.headers["x-admin-key"] || "");
  if (!expected || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function bodyOf(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
}

// ---------- Ανάγνωση / εγγραφή αρχείων ----------

// Η διεύθυνση του αποθηκευτικού χώρου (π.χ. https://xxxx.public.blob.vercel-storage.com)
let baseUrl = "";

async function writeJson(pathname, data) {
  const r = await put(pathname, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  if (!baseUrl) baseUrl = new URL(r.url).origin;
  return r;
}

// fresh = true: παρακάμπτει την cache (για ανάγνωση πριν από εγγραφή)
async function readJson(pathname, fresh) {
  if (!baseUrl) return null;
  const url = `${baseUrl}/${pathname}${fresh ? `?v=${Date.now()}` : ""}`;
  const r = await fetch(url, fresh ? { cache: "no-store" } : undefined);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`read ${pathname}: ${r.status}`);
  return r.json();
}

// Μία φορά ανά «εκκίνηση» της function: βρες τη διεύθυνση και, αν χρειάζεται, κάνε τη μεταφορά.
let ready = null;
function ensureReady() {
  if (!ready) {
    ready = (async () => {
      try {
        const meta = await head(META); // απλή κίνηση
        baseUrl = new URL(meta.url).origin;
      } catch (e) {
        // ΜΟΝΟ αν το αρχείο δεν υπάρχει (πρώτη φορά). Σε άλλο σφάλμα δεν ξανακάνουμε μεταφορά,
        // γιατί θα έγραφε από πάνω τα νεότερα σκορ.
        if (!(e instanceof BlobNotFoundError)) throw e;
        await migrate();
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

// ---------- Μεταφορά των παλιών δεδομένων (μία φορά) ----------
// Παλιά μορφή: scores/<κλειδί>/<πόντοι>_<σωστά>_<σύνολο>_<χρόνος>_<όνομα hex>_<τυχαίο>.txt
//              players/<όνομα hex>/t_<hash συσκευής>.txt και p_<hash κωδικού>.txt
// Πριν από τα σταθερά κλειδιά υπήρχε και η «εποχή 2» (αριθμοί μαθημάτων) — μεταφέρεται κι αυτή.
const ERA2_START = 1794502865253;
const ERA2_END = 1794506424884;
const ERA2_IDS = {
  "58e4d866": "0", "0fc78b2c": "1", e535dba8: "2", f17584f7: "3", edeedd41: "4",
  "3d9410d4": "5", "17b83bec": "6", e8b8fddb: "7", "17f5ce06": "8", f79eb91d: "9",
  b06d60e6: "10", "35203fea": "11", "4ef0ba59": "12", "8eb00ed2": "13", aa038aac: "14",
  "63b8d210": "15", "766e4934": "16",
};
const ERA2_KEYS = Object.fromEntries(Object.entries(ERA2_IDS).map(([k, v]) => [v, k]));

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function migrate() {
  const [oldScores, oldPlayers] = await Promise.all([listAll("scores/"), listAll("players/")]);
  const players = new Map(); // norm -> παίκτης
  const getPlayer = (name) => {
    const norm = normName(name);
    if (!players.has(norm)) players.set(norm, { name, pins: [], tokens: [], scores: {} });
    return players.get(norm);
  };

  for (const b of oldScores) {
    const parts = b.pathname.split("/");
    let key = parts[1] || "";
    const [points, correct, total, time, nameHex] = parts.pop().replace(/\.txt$/, "").split("_");
    const e = { best: Number(points), correct: Number(correct), total: Number(total), time: Number(time) };
    if (!KEY_RE.test(key)) {
      // εποχή 2: «<αριθμός>-<δυσκολία>»
      const [num, mode] = key.split("-");
      if (!(e.time >= ERA2_START && e.time < ERA2_END) || !ERA2_KEYS[num]) continue;
      key = `${ERA2_KEYS[num]}-${mode}`;
      if (!KEY_RE.test(key)) continue;
    }
    const name = fromHex(nameHex || "");
    if (!normName(name) || isBlockedName(name)) continue;
    const p = getPlayer(name);
    p.scores[key] = mergeRecord(p.scores[key], e);
  }

  // μετά τα σκορ, ώστε το όνομα να έχει τη γραφή του παίκτη (όχι τη «κανονικοποιημένη»)
  for (const b of oldPlayers) {
    const [, hex, file] = b.pathname.split("/");
    const p = getPlayer(fromHex(hex));
    const f = file.replace(/\.txt$/, "");
    if (f.startsWith("t_")) p.tokens.push(f.slice(2));
    if (f.startsWith("p_")) p.pins.push(f.slice(2));
  }

  // κατατάξεις από τα ρεκόρ των παικτών
  const boards = {};
  for (const p of players.values()) {
    for (const [key, r] of Object.entries(p.scores)) {
      (boards[key] = boards[key] || []).push({ name: p.name, points: r.best, correct: r.bestCorrect ?? r.correct, total: r.bestTotal ?? r.total, time: r.bestTime ?? r.time });
    }
  }

  await Promise.all([
    ...[...players.entries()].map(([norm, p]) => writeJson(playerPath(norm), p)),
    ...Object.entries(boards).map(([key, list]) => writeJson(boardPath(key), sortBoard(list))),
  ]);
  await writeJson(META, { version: 2, migrated: Date.now() });
}

// ---------- Ρεκόρ και κατάταξη ----------

// Ρεκόρ παίκτη σε ένα κεφάλαιο: καλύτεροι πόντοι + καλύτερο ποσοστό σωστών
function mergeRecord(old, e) {
  if (!old) {
    return { best: e.best, bestCorrect: e.correct, bestTotal: e.total, bestTime: e.time, correct: e.correct, total: e.total, time: e.time };
  }
  const r = { ...old };
  if (e.best > r.best) {
    r.best = e.best;
    r.bestCorrect = e.correct;
    r.bestTotal = e.total;
    r.bestTime = e.time;
  }
  if (e.correct / e.total > r.correct / r.total) {
    r.correct = e.correct;
    r.total = e.total;
  }
  r.time = Math.max(r.time, e.time);
  return r;
}

function sortBoard(entries) {
  return entries
    .filter((e) => !isBlockedName(e.name))
    .sort((a, b) => b.points - a.points || a.time - b.time)
    .slice(0, KEEP);
}

async function readBoard(key, fresh) {
  return (await readJson(boardPath(key), fresh)) || [];
}

const publicBoard = (board) =>
  board
    .filter((e) => !isBlockedName(e.name))
    .slice(0, TOP)
    .map(({ name, points, correct, total, time }) => ({ name, points, correct, total, time }));

// "free" | "mine" | "taken"
function statusOf(player, norm, token) {
  if (!player || (player.pins.length === 0 && player.tokens.length === 0)) return "free";
  if (TOKEN_RE.test(token) && player.tokens.includes(tokenHash(norm, token))) return "mine";
  return "taken";
}

// ---------- Handler ----------

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "Ο πίνακας κατάταξης δεν είναι ρυθμισμένος" });
  }

  try {
    await ensureReady();

    // ----- Έλεγχος ονόματος -----
    if (req.method === "GET" && req.query.checkName !== undefined) {
      const name = cleanName(req.query.checkName);
      if (!name) return res.status(200).json({ ok: true, status: "free" });
      if (isBlockedName(name)) return res.status(200).json({ ok: false, status: "blocked" });
      const norm = normName(name);
      const player = await readJson(playerPath(norm), false);
      return res.status(200).json({ ok: true, status: statusOf(player, norm, String(req.query.token || "")) });
    }

    // ----- Τα σκορ ενός παίκτη -----
    if (req.method === "GET" && req.query.player !== undefined) {
      const norm = normName(req.query.player);
      if (!norm) return res.status(400).json({ error: "Γράψε όνομα" });
      const player = await readJson(playerPath(norm), true);
      const status = statusOf(player, norm, String(req.query.token || ""));
      if (status === "free") return res.status(200).json({ scores: [] });
      if (status !== "mine") {
        return res.status(403).json({
          error: "Αυτό το όνομα είναι συνδεδεμένο με άλλη συσκευή. Γράψε τον κωδικό σου στην αρχική.",
          code: "taken",
        });
      }
      const scores = Object.entries(player.scores || {})
        .map(([key, r]) => ({ key, best: r.best, correct: r.correct, total: r.total, time: r.time }))
        .sort((a, b) => b.time - a.time);
      return res.status(200).json({ scores });
    }

    // ----- Διαχείριση -----
    if (req.method === "GET" && req.query.admin) {
      if (!isAdmin(req)) return res.status(401).json({ error: "Λάθος κωδικός" });
      const files = await listAll("pl/");
      const all = await Promise.all(files.map((b) => fetch(`${b.url}?v=${Date.now()}`).then((r) => r.json()).catch(() => null)));
      const scores = [];
      const players = [];
      for (const p of all.filter(Boolean)) {
        players.push({ name: p.name, devices: p.tokens.length });
        for (const [key, r] of Object.entries(p.scores || {})) {
          scores.push({
            key,
            name: p.name,
            points: r.best,
            correct: r.bestCorrect ?? r.correct,
            total: r.bestTotal ?? r.total,
            time: r.time,
            url: `${key}|${p.name}`,
          });
        }
      }
      scores.sort((a, b) => b.time - a.time);
      players.sort((a, b) => a.name.localeCompare(b.name, "el"));
      return res.status(200).json({ scores, players });
    }

    if (req.method === "DELETE") {
      if (!isAdmin(req)) return res.status(401).json({ error: "Λάθος κωδικός" });
      const body = bodyOf(req);
      if (body.player !== undefined) {
        // ξεκλείδωμα: σβήνουμε κωδικούς/συσκευές, κρατάμε τα σκορ
        const norm = normName(body.player);
        const player = await readJson(playerPath(norm), true);
        if (!player) return res.status(400).json({ error: "Λάθος όνομα" });
        await writeJson(playerPath(norm), { ...player, pins: [], tokens: [] });
        return res.status(200).json({ ok: true });
      }
      const [key, name] = String(body.url || "").split("|");
      if (!KEY_RE.test(key) || !name) return res.status(400).json({ error: "Λάθος σκορ" });
      const norm = normName(name);
      const [player, board] = await Promise.all([readJson(playerPath(norm), true), readBoard(key, true)]);
      if (player && player.scores && player.scores[key]) {
        delete player.scores[key];
        await writeJson(playerPath(norm), player);
      }
      const nb = board.filter((e) => normName(e.name) !== norm);
      if (nb.length !== board.length) await writeJson(boardPath(key), nb);
      return res.status(200).json({ ok: true });
    }

    // ----- Κατάταξη -----
    if (req.method === "GET") {
      const key = String(req.query.key || "");
      if (!KEY_RE.test(key)) return res.status(400).json({ error: "Λάθος μάθημα" });
      return res.status(200).json({ scores: publicBoard(await readBoard(key, false)) });
    }

    if (req.method === "POST") {
      const body = bodyOf(req);

      // «Είμαι εγώ»: σύνδεση του ονόματος με αυτή τη συσκευή με τον κωδικό
      if (body.action === "claim") {
        const norm = normName(body.name);
        const token = String(body.token || "");
        const pin = String(body.pin || "").trim();
        if (!norm || !TOKEN_RE.test(token) || !/^\d{4}$/.test(pin)) {
          return res.status(400).json({ error: "Γράψε τον 4ψήφιο κωδικό σου." });
        }
        const player = await readJson(playerPath(norm), true);
        if (!player || !player.pins.includes(pinHash(norm, pin))) {
          return res.status(403).json({ error: "Λάθος κωδικός. Δοκίμασε ξανά ή διάλεξε άλλο όνομα." });
        }
        const th = tokenHash(norm, token);
        if (!player.tokens.includes(th)) {
          player.tokens.push(th);
          await writeJson(playerPath(norm), player);
        }
        return res.status(200).json({ ok: true });
      }

      const key = String(body.key || "");
      const name = cleanName(body.name);
      const token = String(body.token || "");
      const total = Math.floor(Number(body.total));
      const correct = Math.floor(Number(body.correct));
      const points = Math.floor(Number(body.points));

      if (!KEY_RE.test(key)) return res.status(400).json({ error: "Λάθος μάθημα" });
      if (!name) return res.status(400).json({ error: "Γράψε όνομα" });
      // Όνομα δοκιμής: δεν αποθηκεύεται
      if (name === "*5") {
        return res.status(200).json({ scores: publicBoard(await readBoard(key, false)), rank: 0, test: true });
      }
      if (isBlockedName(name)) {
        return res.status(400).json({
          error: "Αυτό το όνομα δεν επιτρέπεται. Διάλεξε άλλο όνομα για την κατάταξη.",
          code: "name",
        });
      }
      if (!(total >= 1 && total <= 50) || !(correct >= 0 && correct <= total)) {
        return res.status(400).json({ error: "Λάθος στοιχεία" });
      }
      if (!(points >= 0 && points <= correct * MAX_POINTS_PER_QUESTION)) {
        return res.status(400).json({ error: "Λάθος στοιχεία" });
      }
      if (!TOKEN_RE.test(token)) return res.status(400).json({ error: "Λάθος στοιχεία" });

      const norm = normName(name);
      const [stored, board] = await Promise.all([readJson(playerPath(norm), true), readBoard(key, true)]);
      let player = stored;
      const status = statusOf(player, norm, token);
      if (status === "taken") {
        return res.status(409).json({
          error:
            "Αυτό το όνομα το έχει ήδη άλλος παίκτης. Αν είσαι εσύ, γράψε τον κωδικό σου στην αρχική· αλλιώς διάλεξε άλλο όνομα.",
          code: "taken",
        });
      }

      // 1) Παίκτης: νέο όνομα ή νέο ρεκόρ -> μία εγγραφή. Αλλιώς καμία.
      let newPin = "";
      let playerChanged = false;
      if (status === "free") {
        newPin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
        player = { name, pins: [pinHash(norm, newPin)], tokens: [tokenHash(norm, token)], scores: (player && player.scores) || {} };
        playerChanged = true;
      }
      const time = Date.now();
      const before = player.scores[key];
      const after = mergeRecord(before, { best: points, correct, total, time });
      const improved = !before || after.best > before.best || after.correct / after.total > before.correct / before.total;
      if (improved) {
        player.scores[key] = after;
        playerChanged = true;
      }
      if (playerChanged) {
        player.name = name; // η πιο πρόσφατη γραφή του ονόματος
        await writeJson(playerPath(norm), player);
      }

      // 2) Κατάταξη: εγγραφή ΜΟΝΟ αν ο παίκτης μπαίνει ή ανεβαίνει.
      const mine = board.find((e) => normName(e.name) === norm);
      const last = board[board.length - 1];
      const qualifies = board.length < KEEP || points > last.points;
      let nb = board;
      if ((mine && points > mine.points) || (!mine && qualifies)) {
        nb = sortBoard([...board.filter((e) => normName(e.name) !== norm), { name, points, correct, total, time }]);
        await writeJson(boardPath(key), nb);
      }

      const scores = publicBoard(nb);
      const rank = scores.findIndex((s) => normName(s.name) === norm) + 1;
      return res.status(200).json({ scores, rank, pin: newPin || undefined });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Σφάλμα διακομιστή" });
  }
};
