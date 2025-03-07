const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// **✔️ Στατικός φάκελος για το frontend**
app.use(express.static(path.join(__dirname, '../frontend/build')));

// **📌 Endpoint για ανάγνωση ερωτήσεων από αρχείο JSON**
const lessonsPath = path.join(__dirname, 'lessons');

app.get('/lessons/:category/:lesson', (req, res) => {
    try {
        const category = decodeURIComponent(req.params.category).normalize('NFC');
        const lesson = decodeURIComponent(req.params.lesson).normalize('NFC');
        const filePath = path.join(lessonsPath, category, `${lesson}.json`);

        console.log(`📂 Αναζήτηση αρχείου: ${filePath}`);

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

// **📌 Όλα τα άλλα routes να επιστρέφουν το `index.html` του frontend**
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// **✔️ Εκκίνηση Server**
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
