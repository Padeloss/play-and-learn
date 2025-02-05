const express = require('express');
const path = require('path');

const app = express();

// 📌 Εξασφαλίζουμε ότι σερβίρονται τα στατικά αρχεία από τον φάκελο "public"
app.use(express.static(path.join(__dirname, '..', 'public')));

// 📌 Σερβίρουμε το favicon από το "public"
app.use('/favicon.ico', express.static(path.join(__dirname, '..', 'public', 'favicon.ico')));

// 📌 Όλες οι διαδρομές να φορτώνουν το index.html από τον ΚΕΝΤΡΙΚΟ φάκελο
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'), (err) => {
    if (err) {
      console.error("❌ Error serving index.html:", err);
      res.status(500).send("Error loading the page");
    }
  });
});

// 📌 Vercel δεν χρειάζεται `app.listen()`
module.exports = app;
