const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Εντοπισμός του index.html από τη ρίζα του project
const INDEX_HTML_PATH = path.join(__dirname, 'index.html');

// Serve static αρχεία από το public
app.use(express.static(path.join(__dirname, 'public')));

// Για οποιοδήποτε route, επιστρέφουμε το index.html
app.get('*', (req, res) => {
  res.sendFile(INDEX_HTML_PATH);
});

// Εκκίνηση του server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

