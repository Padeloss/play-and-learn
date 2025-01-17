const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Database connection (χρησιμοποίησε MongoDB Atlas)
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error(err));

// Routes
app.get('/', (req, res) => {
  res.send('Hello, Play and Learn!');
});

module.exports = app; // Αντί για app.listen()
