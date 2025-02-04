const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Σερβίρουμε στατικά αρχεία από τον φάκελο "public"
app.use(express.static(path.join(__dirname, 'public')));

// Αν το Vercel δεν βλέπει τον "public", δοκιμάζουμε και τον "__dirname"
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  console.log("Trying to serve:", indexPath);

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(500).send("Error loading the page");
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
