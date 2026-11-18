import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./gamer.css";
import App from "./components/App"; // ✅ Εδώ δεν πρέπει να υπάρχει "./components/components"

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Εγκατάσταση στο κινητό και λειτουργία χωρίς ίντερνετ (μόνο στο κανονικό site, όχι στη δοκιμή)
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
