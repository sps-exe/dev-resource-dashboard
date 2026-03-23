# 🚀 DevPulse — GitHub Trending Dashboard

<div align="center">

[![Live on Vercel](https://img.shields.io/badge/▲%20Live%20Demo-Visit%20Site-black?style=for-the-badge&logo=vercel)](https://project-wap.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/sps-exe/dev-resource-dashboard?style=for-the-badge&logo=github)](https://github.com/sps-exe/dev-resource-dashboard/stargazers)
[![Security Headers](https://img.shields.io/badge/Security-A%2B%20Headers-brightgreen?style=for-the-badge&logo=shield)](https://securityheaders.com/?q=project-wap.vercel.app)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-blue?style=for-the-badge)](https://github.com/sps-exe/dev-resource-dashboard)

**Track trending GitHub repositories in real-time. Built with zero dependencies.**

[**→ Open DevPulse**](https://project-wap.vercel.app)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔥 **Trending by Star Velocity** | Top repos sorted by stars/hour — not just total stars |
| 🏆 **Podium View** | Gold/Silver/Bronze spotlight for the top 3 rising repos |
| 🗂️ **Category Browser** | Filter repos by domain: AI, Web, Mobile, Gaming, DevTools & more |
| ❤️ **Favorites** | Bookmark repos to `localStorage` — persists across sessions |
| 🔍 **Live Search** | Instant client-side search with language filters |
| 📋 **Grid / List Mode** | Toggle between card grid and compact list view |
| 🌙 **Dark / Light Theme** | Dark-first design; theme saved to `localStorage` |
| 📱 **Fully Responsive** | Mobile-optimized with bottom-sheet modal on small screens |
| 🔐 **Security Hardened** | CSP, HSTS, X-Frame-Options, URL validation, rate-limit handling |

---

## 🖥️ Live Demo

> **[https://project-wap.vercel.app](https://project-wap.vercel.app)**

Click above — no login, no install, nothing to configure. It just works.

---

## 🛡️ Security

This project implements defence-in-depth across all layers:

- **Vercel Headers** — `Content-Security-Policy`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (1yr), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
- **HTML Meta Tags** — Fallback security meta tags for `X-Content-Type-Options`, `Referrer-Policy`, and CSP
- **JavaScript** — `safeUrl()` validates all GitHub URLs before use; `checkRateLimit()` handles API quota gracefully; all `target="_blank"` links use `rel="noopener noreferrer"`

---

## 🛠️ Tech Stack

- **HTML5** — Semantic, accessible structure
- **Vanilla CSS** — CSS Grid, Flexbox, custom properties, `@media` queries
- **Vanilla JS** — Zero frameworks. DOM APIs, `fetch`, `localStorage`
- **GitHub REST API** — `https://api.github.com/search/repositories`
- **Vercel** — Edge CDN deployment with security headers

---

## 📁 Project Structure

```
devpulse/
├── index.html      # App shell — nav, hero, tab sections, modal
├── style.css       # Design system — tokens, components, dark/light theme, responsive
├── app.js          # All logic — fetch, render, search, favorites, security utils
└── vercel.json     # Production security headers (CSP, HSTS, X-Frame-Options…)
```

---

## 🚀 Run Locally

No build step. No `npm install`. Open and go:

```bash
git clone https://github.com/sps-exe/dev-resource-dashboard.git
cd dev-resource-dashboard
open index.html   # macOS
# or just drag index.html into any browser
```

---

## 📸 Screenshots

| Dark Mode — Trending | Categories | Favorites |
|---|---|---|
| Real-time star velocity ranking | Browse by domain category | Locally persisted bookmarks |

---

## 📄 License

MIT — free to use, fork, and build on.

---

<div align="center">
  Made with ☕ by <a href="https://github.com/sps-exe">sps-exe</a> &nbsp;|&nbsp; Deployed on <a href="https://vercel.com">Vercel</a>
</div>
