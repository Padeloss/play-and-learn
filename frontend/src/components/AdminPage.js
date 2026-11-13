import React, { useState } from "react";

// Κρυφή σελίδα διαχείρισης της κατάταξης: play-and-learn.vercel.app/#/admin
// Χρειάζεται τον κωδικό ADMIN_KEY (ρυθμίσεις του project στο Vercel → Environment Variables).
// Δείχνει όλα τα σκορ (τα νεότερα πρώτα) και επιτρέπει να σβηστεί όποιο έχει άσχημο όνομα.
// Δείχνει και τα «κλειδωμένα» ονόματα: «Ξεκλείδωσε» αν κάποιος ξέχασε τον κωδικό του
// (την επόμενη φορά που θα παίξει, το όνομα κλειδώνει ξανά και παίρνει νέο κωδικό).

const ADMIN_KEY_STORAGE = "playandlearn-admin";

function readKey() {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

function saveKey(k) {
  try {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, k);
  } catch {
    /* δεν πειράζει */
  }
}

function AdminPage({ describeKey, onBack }) {
  const [code, setCode] = useState(readKey);
  const [scores, setScores] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [confirmUrl, setConfirmUrl] = useState("");
  const [message, setMessage] = useState("");
  const [players, setPlayers] = useState([]);
  const [confirmPlayer, setConfirmPlayer] = useState("");

  async function load(k = code) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/scores?admin=1", { headers: { "x-admin-key": k } });
      if (r.status === 401) throw new Error("Λάθος κωδικός.");
      if (!r.ok) throw new Error("Η κατάταξη δεν είναι διαθέσιμη αυτή τη στιγμή.");
      const data = await r.json();
      saveKey(k);
      setScores(data.scores || []);
      setPlayers(data.players || []);
    } catch (e) {
      setScores(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(s) {
    setError("");
    try {
      const r = await fetch("/api/scores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-key": code },
        body: JSON.stringify({ url: s.url }),
      });
      if (!r.ok) throw new Error();
      setScores((list) => list.filter((x) => x.url !== s.url));
      setConfirmUrl("");
      setMessage(`Σβήστηκε: «${s.name}» (${s.points} π.)`);
    } catch {
      setError("Δεν σβήστηκε. Δοκίμασε ξανά.");
    }
  }

  async function unlock(p) {
    setError("");
    try {
      const r = await fetch("/api/scores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-key": code },
        body: JSON.stringify({ player: p.name }),
      });
      if (!r.ok) throw new Error();
      setPlayers((list) => list.filter((x) => x.name !== p.name));
      setConfirmPlayer("");
      setMessage(`Ξεκλείδωσε το όνομα «${p.name}».`);
    } catch {
      setError("Δεν ξεκλείδωσε. Δοκίμασε ξανά.");
    }
  }

  const shown = (scores || []).filter(
    (s) => !filter.trim() || s.name.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <>
      <button className="link back-link" onClick={onBack}>
        ← Αρχική
      </button>
      <h1>Διαχείριση κατάταξης</h1>

      <form
        className="panel name-panel"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label htmlFor="admin-code">Κωδικός διαχειριστή</label>
        <input
          id="admin-code"
          type="password"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div>
          <button className="primary" type="submit" disabled={loading || !code}>
            {loading ? "Φόρτωση…" : "Δείξε τα σκορ"}
          </button>
        </div>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="rank" role="status">
          {message}
        </p>
      )}

      {scores && (
        <>
          <label className="select-label" htmlFor="admin-filter">
            Αναζήτηση ονόματος
          </label>
          <input
            id="admin-filter"
            className="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="π.χ. Νίκος"
          />
          <p className="muted">
            {shown.length} από {scores.length} σκορ (τα νεότερα πρώτα)
          </p>
          <div className="panel">
            {shown.length === 0 && <p className="muted">Δεν υπάρχει κανένα σκορ.</p>}
            <ul className="admin-list">
              {shown.map((s) => (
                <li key={s.url}>
                  <div className="admin-info">
                    <b>{s.name}</b> · {s.points} π. ({s.correct}/{s.total})
                    <small className="muted">
                      {describeKey(s.key)} ·{" "}
                      {new Date(s.time).toLocaleString("el-GR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                  {confirmUrl === s.url ? (
                    <span className="admin-actions">
                      <button className="primary danger" onClick={() => remove(s)}>
                        Σίγουρα, σβήσ' το
                      </button>
                      <button className="secondary" onClick={() => setConfirmUrl("")}>
                        Άκυρο
                      </button>
                    </span>
                  ) : (
                    <button className="secondary" onClick={() => setConfirmUrl(s.url)}>
                      Σβήσε
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <h2>Ονόματα παικτών ({players.length})</h2>
          <p className="muted">
            Κάθε όνομα ανήκει σε έναν παίκτη. Αν κάποιος ξέχασε τον κωδικό του, πάτα «Ξεκλείδωσε».
          </p>
          <div className="panel">
            {players.length === 0 && <p className="muted">Κανένα όνομα ακόμα.</p>}
            <ul className="admin-list">
              {players.map((p) => (
                <li key={p.name}>
                  <div className="admin-info">
                    <b>{p.name}</b>
                    <small className="muted">
                      {p.devices} {p.devices === 1 ? "συσκευή" : "συσκευές"}
                    </small>
                  </div>
                  {confirmPlayer === p.name ? (
                    <span className="admin-actions">
                      <button className="primary danger" onClick={() => unlock(p)}>
                        Σίγουρα
                      </button>
                      <button className="secondary" onClick={() => setConfirmPlayer("")}>
                        Άκυρο
                      </button>
                    </span>
                  ) : (
                    <button className="secondary" onClick={() => setConfirmPlayer(p.name)}>
                      Ξεκλείδωσε
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}

export default AdminPage;
