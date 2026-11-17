// Αναφορές λάθους ερωτήσεων.
//
// POST /api/reports  { token, subject, mode, question, correct, note }  -> αποθήκευση αναφοράς
//   Μία αναφορά ανά συσκευή και ερώτηση (η δεύτερη αντικαθιστά την πρώτη, άρα δεν γίνεται spam).
// Διαχείριση (κρυφή σελίδα #/admin, με τον ίδιο κωδικό ADMIN_KEY):
// GET    /api/reports?admin=1  (header x-admin-key)  -> όλες οι αναφορές, ομαδοποιημένες ανά ερώτηση
// DELETE /api/reports  { question }  (header x-admin-key)  -> σβήνει όλες τις αναφορές μιας ερώτησης
//
// Κάθε αναφορά είναι ένα μικρό αρχείο JSON στο Vercel Blob: reports/<hash ερώτησης>/<hash συσκευής>.json
const crypto = require("crypto");
const { put, list, del } = require("@vercel/blob");

const TOKEN_RE = /^[A-Za-z0-9-]{16,64}$/;

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function clean(raw, max) {
  return String(raw || "")
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function isAdmin(req) {
  const expected = process.env.ADMIN_KEY || "";
  const given = String(req.headers["x-admin-key"] || "");
  if (!expected || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function bodyOf(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "Οι αναφορές δεν είναι ρυθμισμένες" });
  }

  try {
    if (req.method === "GET" && req.query.admin) {
      if (!isAdmin(req)) return res.status(401).json({ error: "Λάθος κωδικός" });
      const blobs = [];
      let cursor;
      do {
        const page = await list({ prefix: "reports/", cursor, limit: 1000 });
        blobs.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor && blobs.length < 1000);

      const items = (
        await Promise.all(
          blobs.map(async (b) => {
            try {
              const r = await fetch(b.url);
              const data = await r.json();
              return { ...data, time: new Date(b.uploadedAt).getTime() || 0 };
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean);

      const byQuestion = new Map();
      for (const it of items) {
        const k = `${it.subject}|${it.question}`;
        const g = byQuestion.get(k) || {
          subject: it.subject,
          mode: it.mode,
          question: it.question,
          correct: it.correct,
          count: 0,
          notes: [],
          time: 0,
        };
        g.count++;
        if (it.note) g.notes.push(it.note);
        g.time = Math.max(g.time, it.time);
        byQuestion.set(k, g);
      }
      const reports = [...byQuestion.values()].sort((a, b) => b.count - a.count || b.time - a.time);
      return res.status(200).json({ reports });
    }

    if (req.method === "DELETE") {
      if (!isAdmin(req)) return res.status(401).json({ error: "Λάθος κωδικός" });
      const body = bodyOf(req);
      const question = clean(body.question, 400);
      if (!question) return res.status(400).json({ error: "Λάθος ερώτηση" });
      const page = await list({ prefix: `reports/${hash(question)}/`, limit: 1000 });
      await Promise.all(page.blobs.map((b) => del(b.url)));
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST") {
      const body = bodyOf(req);
      const token = String(body.token || "");
      const question = clean(body.question, 400);
      if (!TOKEN_RE.test(token) || !question) {
        return res.status(400).json({ error: "Λάθος στοιχεία" });
      }
      const report = {
        subject: clean(body.subject, 100),
        mode: clean(body.mode, 100),
        question,
        correct: clean(body.correct, 200),
        note: clean(body.note, 200),
      };
      await put(`reports/${hash(question)}/${hash(token)}.json`, JSON.stringify(report), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Σφάλμα διακομιστή" });
  }
};
