const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Ορισμός του public ως στατικού φακέλου
app.use(express.static(path.join(__dirname, 'public')));

// Επιστροφή του index.html για οποιοδήποτε route (για SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Εκκίνηση του server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
