const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Εξυπηρετούμε στατικά αρχεία από τον φάκελο "public" αν υπάρχει
app.use(express.static(path.join(__dirname, 'public')));

// Αντιμετωπίζουμε την περίπτωση που το index.html είναι στη ρίζα
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Για όλα τα άλλα routes, επίσης επιστρέφουμε το index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Εκκίνηση server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
