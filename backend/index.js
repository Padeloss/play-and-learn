const express = require('express');
const bodyParser = require('body-parser');
const questions = require('./questions.json'); // Εδώ φορτώνουμε τις ερωτήσεις από τοπικό JSON

const app = express();
app.use(bodyParser.json());

// Route για να επιστρέφει τις ερωτήσεις
app.get('/api/questions', (req, res) => {
  res.json(questions);
});

app.get('/', (req, res) => {
  res.send('✅ Hello, Play and Learn! Backend is working.');
});

// Server listen μόνο αν δεν είμαστε σε Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(3000, () => console.log("🚀 Server running on port 3000"));
}

module.exports = app;
