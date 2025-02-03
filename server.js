const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Εξυπηρετούμε στατικά αρχεία από τον φάκελο "public"
app.use(express.static(path.join(__dirname, 'public')));

// Αν το index.html είναι στη ρίζα, το εξυπηρετούμε εδώ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Για οποιοδήποτε άλλο route, επιστρέφουμε το index.html (για SPAs)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Εκκίνηση server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
