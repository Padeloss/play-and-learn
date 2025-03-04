const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware για να διαβάζει JSON
app.use(express.json());

// Διόρθωση encoding URL (για ελληνικούς χαρακτήρες)
app.get('/lessons/:category/:lesson', (req, res) => {
    const category = decodeURIComponent(req.params.category);
    const lesson = decodeURIComponent(req.params.lesson);
    const filePath = path.join(__dirname, 'lessons', category, `${lesson}.json`);

    console.log(`📂 Αναζήτηση αρχείου: ${filePath}`); // Debug log

    // Έλεγχος αν υπάρχει το αρχείο
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Το αρχείο δεν βρέθηκε: ${filePath}`);
        return res.status(404).json({ error: 'Lesson not found' });
    }

    // Ανάγνωση και αποστολή JSON
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`❌ Σφάλμα ανάγνωσης αρχείου: ${err}`);
            return res.status(500).json({ error: 'Error reading file' });
        }
        try {
            res.json(JSON.parse(data));
        } catch (parseError) {
            console.error(`❌ Σφάλμα στο JSON format: ${parseError}`);
            res.status(500).json({ error: 'Invalid JSON format' });
        }
    });
});

// Προσθήκη route για το favicon.ico για να αποφύγουμε 500 error
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No Content
});

module.exports = app;
