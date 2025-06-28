import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add Material Icons
const link = document.createElement("link");
link.href = "https://fonts.googleapis.com/icon?family=Material+Icons";
link.rel = "stylesheet";
document.head.appendChild(link);

// Add Inter font
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// Add title
const title = document.createElement("title");
title.textContent = "Referee Admin - Sports Club Dashboard";
document.head.appendChild(title);

// Add meta description
const metaDescription = document.createElement("meta");
metaDescription.name = "description";
metaDescription.content = "Referee Admin - Scalable Referee Assignment Tool for Sports Clubs. Manage matches, referees, and assignments efficiently.";
document.head.appendChild(metaDescription);

createRoot(document.getElementById("root")!).render(<App />);
