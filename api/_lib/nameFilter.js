// Φίλτρο για τα ονόματα της κατάταξης (η λίστα είναι δημόσια και τη βλέπουν παιδιά).
//
// Το όνομα «καθαρίζεται» πριν από τον έλεγχο: μικρά γράμματα, χωρίς τόνους, χωρίς κενά
// και σύμβολα, και τα «κόλπα» όπως 0→o, 1→i, 3→e, 4→a, @→a, $→s. Έτσι πιάνονται και
// γραφές όπως «Μ@λ@κ@ς», «m a l a k a s» ή «p0ust1s».
//
// Για να προσθέσεις λέξη: γράψ' τη στη λίστα BLOCKED με μικρά γράμματα, χωρίς τόνους.
// Αρκεί ένα κομμάτι της λέξης (π.χ. «μαλακ» πιάνει «μαλάκας», «μαλακία» κ.λπ.).

const BLOCKED = [
  // ελληνικά
  "μαλακ",
  "γαμω",
  "γαμησ",
  "γαμιε",
  "γαμημ",
  "γαμιολ",
  "πουτα",
  "πουτσ",
  "μουνι",
  "μουνο",
  "πουστ",
  "καριολ",
  "σκατα",
  "σκατο",
  "σκατε",
  "αρχιδι",
  "τσουλα",
  "βυζι",
  "κωλοπαιδ",
  "κωλαρ",
  "χεστ",
  "κλανι",
  "ηλιθι",
  "βλακα",
  "καθυστερημεν",
  "σιχαμ",
  "αιδοι",
  "πεος",
  // greeklish
  "malak",
  "gamw",
  "gamo",
  "gamhs",
  "gamis",
  "gamiol",
  "poutan",
  "pouts",
  "mouni",
  "mouno",
  "pousti",
  "poustr",
  "kariol",
  "skata",
  "arxidi",
  "archidi",
  "tsoula",
  "vizi",
  "kolopaid",
  "xest",
  "vlaka",
  "ilithi",
  "hlithi",
  // αγγλικά
  "fuck",
  "fuk",
  "shit",
  "bitch",
  "dick",
  "cunt",
  "pussy",
  "asshole",
  "bastard",
  "slut",
  "whore",
  "porn",
  "sexy",
  "nazi",
  "hitler",
  "nigg",
  "fag",
  "retard",
  "penis",
  "boob",
  "idiot",
  "stupid",
];

const LEET = {
  0: "o",
  1: "i",
  3: "e",
  4: "a",
  5: "s",
  7: "t",
  "@": "a",
  $: "s",
  "!": "i",
};

// Ελληνικά -> λατινικά, ώστε «Μ@λ@κας», «malakas» και «Pούτσα» να γίνονται ίδια μορφή
const GREEK = {
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "u",
  φ: "f",
  χ: "x",
  ψ: "ps",
  ω: "o",
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // τόνοι, διαλυτικά
    .replace(/[013457@$!]/g, (c) => LEET[c] || c)
    .replace(/[α-ως]/g, (c) => GREEK[c] || c)
    .replace(/ch/g, "x")
    .replace(/[^a-z]/g, "") // κενά, τελείες, παύλες κ.λπ.
    .replace(/ou/g, "u")
    .replace(/y/g, "u")
    .replace(/w/g, "o");
}

// true αν το όνομα περιέχει λέξη από τη λίστα
function isBlockedName(name) {
  const n = normalize(name);
  if (!n) return false;
  return BLOCKED.some((w) => n.includes(normalize(w)));
}

module.exports = { isBlockedName, normalize };
