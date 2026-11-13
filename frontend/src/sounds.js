// Ήχοι του παιχνιδιού, φτιαγμένοι με το Web Audio API (χωρίς αρχεία mp3).
//
// Δύο «θέματα» ήχων, που ορίζονται ανά τάξη στο backend/lessons/grades.json ("sound"):
//   kids  -> Δημοτικό: χαρούμενα καμπανάκια, απαλά και ευχάριστα
//   metal -> Γυμνάσιο: ηλεκτρική κιθάρα με παραμόρφωση (power chords)
//   arcade -> Λύκειο (ΕΠΑΛ): synthwave / ηχητικά εφέ ρετρό ηλεκτρονικού παιχνιδιού
//
// Κάθε θέμα έχει τρεις ήχους: correct (σωστό), wrong (λάθος), finish (τέλος κουίζ).

let ctx = null;

function audio() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Συχνότητα από νότα MIDI (69 = Λα 440 Hz)
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ---------- Δημοτικό: καμπανάκια ----------

// Μία νότα «καμπανάκι»: ημιτονοειδής + λίγο αρμονικό, με απαλό σβήσιμο
function bell(ac, out, midi, start, length = 0.35, volume = 0.25) {
  [1, 2, 3].forEach((harmonic, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = i === 0 ? "triangle" : "sine";
    osc.frequency.value = hz(midi) * harmonic;
    const v = volume / (1 + i * 2.5);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(v, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + length + 0.05);
  });
}

const kids = {
  // Ανεβαίνει χαρούμενα: Ντο – Μι – Σολ – Ντο
  correct(ac, out, t) {
    [72, 76, 79, 84].forEach((n, i) => bell(ac, out, n, t + i * 0.07, 0.4));
  },
  // Απαλό «ουπς»: δύο νότες που κατεβαίνουν, χωρίς να τρομάζει
  wrong(ac, out, t) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(hz(67), t);
    osc.frequency.exponentialRampToValueAtTime(hz(60), t + 0.35);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.5);
  },
  // Μικρή μελωδία νίκης
  finish(ac, out, t) {
    const notes = [72, 74, 76, 79, 76, 79, 84];
    notes.forEach((n, i) => bell(ac, out, n, t + i * 0.12, i === notes.length - 1 ? 0.9 : 0.3));
  },
};

// ---------- Γυμνάσιο: metal κιθάρα ----------

function distortionCurve(amount) {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

// Αλυσίδα «ενισχυτή»: παραμόρφωση + φίλτρο για να μη τσιρίζει
function amp(ac, out) {
  const drive = ac.createWaveShaper();
  drive.curve = distortionCurve(60);
  drive.oversample = "4x";
  const tone = ac.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3200;
  const master = ac.createGain();
  master.gain.value = 0.09;
  drive.connect(tone).connect(master).connect(out);
  return drive;
}

// Power chord (ρίζα + πέμπτη + οκτάβα) με «palm mute» ή ανοιχτό
function powerChord(ac, input, root, start, length, { slideTo = null } = {}) {
  [0, 7, 12].forEach((interval) => {
    [-6, 6].forEach((detune) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(hz(root + interval), start);
      if (slideTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(hz(slideTo + interval), start + length);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.008);
      gain.gain.setValueAtTime(0.5, start + length * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(gain).connect(input);
      osc.start(start);
      osc.stop(start + length + 0.05);
    });
  });
}

// Τύμπανο (κάσα) για έξτρα «χτύπημα»
function kick(ac, out, start) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, start);
  osc.frequency.exponentialRampToValueAtTime(40, start + 0.15);
  gain.gain.setValueAtTime(0.28, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + 0.25);
}

const metal = {
  // Δύο γρήγορα «τσακ» και ένα ανοιχτό power chord ψηλότερα (Μι5 → Σολ5 → Λα5)
  correct(ac, out, t) {
    const input = amp(ac, out);
    powerChord(ac, input, 40, t, 0.09);
    powerChord(ac, input, 43, t + 0.1, 0.09);
    powerChord(ac, input, 45, t + 0.2, 0.55);
    kick(ac, out, t);
    kick(ac, out, t + 0.2);
  },
  // Βαρύ chord που «πέφτει» προς τα κάτω (dive bomb)
  wrong(ac, out, t) {
    const input = amp(ac, out);
    powerChord(ac, input, 41, t, 0.6, { slideTo: 29 });
    kick(ac, out, t);
  },
  // Riff τερματισμού
  finish(ac, out, t) {
    const input = amp(ac, out);
    const riff = [40, 40, 43, 40, 45, 43, 47];
    riff.forEach((n, i) => {
      const last = i === riff.length - 1;
      powerChord(ac, input, n, t + i * 0.13, last ? 1.1 : 0.11);
      if (i % 2 === 0 || last) kick(ac, out, t + i * 0.13);
    });
  },
};

// ---------- Λύκειο: arcade / synthwave ----------

// Μία νότα «chiptune»: τετραγωνικό κύμα με γρήγορο σβήσιμο
function chip(ac, out, midi, start, length = 0.12, volume = 0.12, type = "square", slideTo = null) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz(midi), start);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(hz(slideTo), start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + length + 0.03);
}

const arcade = {
  // Γρήγορο «coin»: δύο νότες που ανεβαίνουν απότομα
  correct(ac, out, t) {
    chip(ac, out, 83, t, 0.07);
    chip(ac, out, 88, t + 0.07, 0.3, 0.12);
    chip(ac, out, 95, t + 0.07, 0.3, 0.05, "triangle");
  },
  // «Game over» ελαφρύ: κατεβαστό σάρωμα
  wrong(ac, out, t) {
    chip(ac, out, 62, t, 0.35, 0.14, "sawtooth", 38);
    chip(ac, out, 50, t + 0.05, 0.3, 0.08, "square", 31);
  },
  // Αρπέγιο νίκης με συνθεσάιζερ
  finish(ac, out, t) {
    const notes = [60, 64, 67, 72, 76, 79, 84];
    notes.forEach((n, i) => {
      chip(ac, out, n, t + i * 0.08, 0.14, 0.11);
      chip(ac, out, n - 12, t + i * 0.08, 0.14, 0.07, "sawtooth");
    });
    chip(ac, out, 84, t + notes.length * 0.08, 0.9, 0.12, "square");
    chip(ac, out, 72, t + notes.length * 0.08, 0.9, 0.08, "sawtooth");
  },
};

const THEMES = { kids, metal, arcade };

export function playSound(name, theme, enabled) {
  if (!enabled) return;
  try {
    const ac = audio();
    if (!ac) return;
    const set = THEMES[theme] || kids;
    if (!set[name]) return;
    set[name](ac, ac.destination, ac.currentTime + 0.01);
  } catch {
    /* ο browser δεν άφησε να παίξει ήχος — δεν πειράζει */
  }
}
