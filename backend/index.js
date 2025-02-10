const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const lessonsPath = path.join(__dirname, 'lessons'); // Ο φάκελος με τα JSON

// Route για να επιστρέφει τις ερωτήσεις ενός μαθήματος
app.get('/api/lessons/:lessonName', (req, res) => {
  const lessonName = req.params.lessonName;
  const filePath = path.join(lessonsPath, `${lessonName}.json`);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    res.json(JSON.parse(data));
  });
});

// Route ελέγχου λειτουργίας
app.get('/', (req, res) => {
  res.send('✅ Backend is working. Lessons are loading from JSON.');
});

// Αν το τρέχεις τοπικά, άνοιξε server
if (process.env.NODE_ENV !== "production") {
  app.listen(3000, () => console.log("🚀 Server running on port 3000"));
}

module.exports = app;
