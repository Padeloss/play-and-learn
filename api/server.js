const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// 📌 Εξασφαλίζουμε ότι σερβίρονται τα στατικά αρχεία από τον φάκελο "public"
app.use(express.static(path.join(__dirname, 'public')));

// 📌 Σερβίρουμε το favicon σωστά
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// 📌 Σερβίρουμε σωστά το index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(500).send("Error loading the page");
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
