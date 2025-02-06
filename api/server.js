const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Σερβίρουμε στατικά αρχεία από τον φάκελο "public"
app.use(express.static(path.join(__dirname, 'public')));

// Σερβίρουμε το index.html για όλες τις διαδρομές
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error("Σφάλμα κατά την εξυπηρέτηση του index.html:", err);
      res.status(500).send("Σφάλμα κατά τη φόρτωση της σελίδας");
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Ο διακομιστής λειτουργεί στη θύρα ${PORT}`);
});
