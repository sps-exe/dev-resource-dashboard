# Developer Resource Intelligence Dashboard

A clean, fast, and easy-to-use directory for developers to discover, explore, and manage useful public APIs and tools.

## 🚀 Features

- **Blazing Fast Search**: Find APIs by name or description instantly.
- **Category Filtering**: Browse through categories like "AI", "Finance", "Weather", etc.
- **No-Nonsense UI**: A minimal, developer-focused interface designed for high information density and keyboard accessibility.
- **Zero Dependencies**: Built with 100% Vanilla Web Technologies (HTML, CSS, JavaScript) for maximum performance and easy explainability.

## 🛠️ Tech Stack

- **HTML5**: Semantic and accessible structure.
- **CSS3**: Modern CSS Grid and Flexbox for responsive layouts (no external CSS frameworks used).
- **Vanilla JavaScript**: Pure JS for DOM manipulation, event handling, and data fetching (no React/Vue/Angular).

## 📁 Project Structure

```text
├── index.html       # The main UI structure (Search bar, Category Dropdown, Card Grid)
├── style.css        # The aesthetic layer 
├── app.js           # The core logic (Fetching, Rendering, Search/Filter pipeline)
└── apis.json        # Fallback local dataset (optional)
```

## 🧠 Architecture Overview

This project uses a simplified **M-V-C (Model-View-Controller)** approach:

1. **Model**: The data fetched from a public API dataset (or local JSON) which acts as the source of truth.
2. **View**: The HTML grid that dynamically renders cards based on the active dataset.
3. **Controller**: The JavaScript logic (`app.js`) that intercepts user inputs (search queries, category clicks), filters the original data, and triggers a re-render of the View.

---

### Getting Started

1. Clone this repository.
2. Open `index.html` in your web browser.
3. No build steps, `npm install`, or local server required!
