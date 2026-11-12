# 🎮 Play and Learn

Εφαρμογή κουίζ για μαθητές, στο πνεύμα του Quizizz. Ο παίκτης διαλέγει μάθημα και δυσκολία και απαντά σε ερωτήσεις πολλαπλής επιλογής.

A Quizizz-like quiz app for students: pick a subject and a difficulty level and answer multiple-choice questions.

## ✨ Τι κάνει

- 9 μαθήματα × 3 δυσκολίες, περίπου 400 ερωτήσεις πολλαπλής επιλογής
- ⏱️ 20 δευτερόλεπτα ανά ερώτηση, με πόντους: 100 για σωστή + έως 100 μπόνους ταχύτητας
- 🔊 Ήχοι για σωστή/λάθος απάντηση (με κουμπί σίγασης)
- 🏆 Πίνακας κατάταξης top 10 ανά μάθημα και δυσκολία (με όνομα παίκτη)
- Ερωτήσεις και απαντήσεις ανακατεμένες σε κάθε παιχνίδι

## 📚 Μαθήματα

| Μάθημα | Δυσκολίες |
|---|---|
| Άλγεβρα | easy · medium · hard |
| Αρχαία (κείμενα) | easy · medium · hard |
| Βιολογία | easy · medium · hard |
| Γεωγραφία | easy · medium · hard |
| Γεωμετρία | easy · medium · hard |
| Ιστορία | easy · medium · hard |
| Νεοελληνικά | easy · medium · hard |
| Φυσική | easy · medium · hard |
| Python | easy · medium · hard |

Οι ερωτήσεις βρίσκονται στον φάκελο `backend/lessons/<Μάθημα>/<δυσκολία>.json`.

## 🛠️ Τεχνολογίες

- **Frontend:** React, ως στατικό site (δεν χρειάζεται server)
- **Ερωτήσεις:** αρχεία JSON· στο build αντιγράφονται αυτόματα στο site από το `frontend/scripts/copy-lessons.js`
- **Hosting:** Vercel, με αυτόματο deploy σε κάθε push στο `main`
- **Κατάταξη:** serverless συνάρτηση `api/scores.js` στο Vercel, με αποθήκευση στο Vercel Blob
- Το προσωπικό ρεκόρ κάθε παίκτη κρατιέται στον browser του

## 🚀 Εκκίνηση τοπικά

```sh
git clone https://github.com/Padeloss/play-and-learn.git
cd play-and-learn
npm install
npm run build
```

Για το παιχνίδι σε λειτουργία ανάπτυξης: `npm start --workspace=frontend` (ανοίγει στο `http://localhost:3000`).

## ➕ Προσθήκη ερωτήσεων

Φτιάξε ή συμπλήρωσε ένα αρχείο JSON στο `backend/lessons/<Μάθημα>/` με όνομα `easy.json`, `medium.json` ή `hard.json`.

## 📄 Άδεια

MIT — δες το αρχείο [LICENSE](LICENSE).
