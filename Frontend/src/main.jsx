import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/weather.css";
import "./styles/admin.css";
import "./styles/modern.css";
import "./styles/pages.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
