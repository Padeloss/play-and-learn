const fs = require('fs'); const path = require('path'); const express = require('express');

const app = express(); const lessonsPath = path.join(__dirname, 'lessons'); // Ο φάκελος με τα JSON αρχεία

// Middleware για να επιτρέπει JSON responses app.use(express.json());

// Route για να επιστρέφει τις ερωτήσεις ενός μαθήματος και δυσκολίας app.get('/api/lessons/:lessonName/:difficulty', (req, res) => { const { lessonName, difficulty } = req.params; const filePath = path.join(lessonsPath, lessonName, ${difficulty}.json);

fs.readFile(filePath, 'utf8', (err, data) => { if (err) { return res.status(404).json({ error: 'Lesson or difficulty level not found' }); } try { res.json(JSON.parse(data)); } catch (parseError) { res.status(500).json({ error: 'Invalid JSON format' }); } }); });

// Route ελέγχου λειτουργίας app.get('/', (req, res) => { res.send('✅ Backend is working. Lessons are loading from JSON.'); });

// Αν το τρέχεις τοπικά, άνοιξε server if (process.env.NODE_ENV !== "production") { app.listen(3000, () => console.log("🚀 Server running on port 3000")); }

module.exports = app;

