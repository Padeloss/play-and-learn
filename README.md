# 🎮 Play and Learn

Εφαρμογή κουίζ για μαθητές, στο πνεύμα του Quizizz. Ο παίκτης διαλέγει μάθημα και δυσκολία και απαντά σε ερωτήσεις πολλαπλής επιλογής.

A Quizizz-like quiz app for students: pick a subject and a difficulty level and answer multiple-choice questions.

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

- **Frontend:** React
- **Backend:** Node.js + Express
- **Hosting:** Vercel, με αυτόματο deploy μέσω GitHub Actions σε κάθε push στο `main`

## 🚀 Εκκίνηση τοπικά

```sh
git clone https://github.com/Padeloss/play-and-learn.git
cd play-and-learn
npm install
npm start
```

Η εφαρμογή ανοίγει στο `http://localhost:3000`.

## ➕ Προσθήκη ερωτήσεων

Φτιάξε ή συμπλήρωσε ένα αρχείο JSON στο `backend/lessons/<Μάθημα>/` με όνομα `easy.json`, `medium.json` ή `hard.json`.

## 📄 Άδεια

MIT — δες το αρχείο [LICENSE](LICENSE).
