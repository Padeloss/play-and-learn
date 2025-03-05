const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware για να διαβάζει JSON
app.use(express.json());

// Διαδρομή για ανάγνωση ερωτήσεων από αρχείο JSON
app.get('/lessons/:category/:lesson', (req, res) => {
    try {
        const category = decodeURIComponent(req.params.category);
        const lesson = decodeURIComponent(req.params.lesson);
        const filePath = path.join(__dirname, 'lessons', category, `${lesson}.json`);

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

// Προσθήκη route για το favicon.ico για να αποφύγουμε 500 error
app.get('/favicon.ico', (req, res) => res.status(204).end());

// **✅ ΝΕΟ: Εκκίνηση server & Debug log**
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

