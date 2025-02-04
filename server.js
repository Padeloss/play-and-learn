const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Debug: Εκτυπώνουμε τη διαδρομή του index.html
console.log("Serving index.html from:", path.join(__dirname, 'index.html'));

// Σερβίρουμε στατικά αρχεία από το public
app.use(express.static(path.join(__dirname, 'public')));

// Σερβίρουμε το index.html
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
