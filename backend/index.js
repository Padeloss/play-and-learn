const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Database connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Routes
app.get('/', (req, res) => {
  res.send('✅ Hello, Play and Learn! Backend is working.');
});

// 🚨 Σημαντικό: Ακούμε το port ΜΟΝΟ αν ΔΕΝ τρέχουμε σε Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(3000, () => console.log("🚀 Server running on port 3000"));
}

module.exports = app;
