const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // ✔️ Για να επιτρέπεται πρόσβαση από το frontend

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // ✔️ Επιτρέπει τα CORS requests
app.use(express.json());

// **✔️ Στατικός φάκελος για αρχεία JSON**
const lessonsPath = path.join(__dirname, 'lessons');

// **📌 Endpoint για ανάγνωση ερωτήσεων από αρχείο JSON**
app.get('/lessons/:category/:lesson', (req, res) => {
    try {
        const category = decodeURIComponent(req.params.category).normalize('NFC');
        const lesson = decodeURIComponent(req.params.lesson).normalize('NFC');
        const filePath = path.join(lessonsPath, category, `${lesson}.json`);

        console.log(`📂 Αναζήτηση αρχείου: ${filePath}`); // Debug log

        if (!fs.existsSync(filePath)) {
            console.error(`❌ Το αρχείο δεν βρέθηκε: ${filePath}`);
            return res.status(404).json({ error: 'Lesson not found' });
        }

        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error(`❌ Σφάλμα: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
});

// **📌 Route για favicon.ico (για αποφυγή 404 errors)**
app.get('/favicon.ico', (req, res) => res.status(204).end());

// **✔️ Εκκίνηση Server**
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
