const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Καθορισμός σωστού path για το αρχείο JSON
const filePath = path.join(__dirname, 'data.json');

app.get('/data', (req, res) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        try {
            res.json(JSON.parse(data));
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            res.status(500).json({ error: 'Invalid JSON format' });
        }
    });
});

// Προσθήκη route για το favicon.ico για να αποφύγουμε 500 error
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No Content
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
