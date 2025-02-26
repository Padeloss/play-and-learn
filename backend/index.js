const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware για να διαβάζει JSON
app.use(express.json());

app.get('/lessons/:category/:lesson', (req, res) => {
  const category = req.params.category;
  const lesson = req.params.lesson;
  const filePath = path.join(__dirname, 'lessons', category, `${lesson}.json`);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(404).json({ error: 'Lesson not found' });
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

module.exports = app;
