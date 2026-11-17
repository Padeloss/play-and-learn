import React, { useState } from "react";

// Διακριτικό κουμπί «Λάθος;» κάτω από την ερώτηση. Ο παίκτης μπορεί (προαιρετικά) να γράψει
// τι νομίζει ότι φταίει και η αναφορά πηγαίνει στη σελίδα διαχείρισης (#/admin).
function ReportButton({ subject, mode, question, correct, token }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error

  async function send() {
    setState("sending");
    try {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subject, mode, question, correct, note }),
      });
      if (!r.ok) throw new Error();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="report-done" role="status">
        Ευχαριστούμε! Θα το ελέγξουμε.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="report-link" onClick={() => setOpen(true)}>
        ⚑ Αναφορά λάθους
      </button>
    );
  }

  return (
    <div className="report-box">
      <label htmlFor="report-note">Τι νομίζεις ότι είναι λάθος σε αυτή την ερώτηση; (προαιρετικό)</label>
      <input
        id="report-note"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="π.χ. η σωστή απάντηση είναι άλλη"
      />
      <div className="report-actions">
        <button type="button" className="primary" onClick={send} disabled={state === "sending"}>
          {state === "sending" ? "Στέλνω…" : "Στείλε"}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Άκυρο
        </button>
      </div>
      {state === "error" && (
        <p className="error" role="alert">
          Δεν στάλθηκε. Δοκίμασε ξανά.
        </p>
      )}
    </div>
  );
}

export default ReportButton;
