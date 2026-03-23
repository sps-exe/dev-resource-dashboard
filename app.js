
const STATE = {
    trending: [],       // Top 30 trending repos
    categories: {},     // { ai: [...], gaming: [...], ... } cached per category
    favorites: [],      // Array of repo full_names from localStorage
    activeTab: "trending",
    activeCategory: "ai",
    searchQuery: "",
    trendingSort: "velocity",
    allSort: "stars-desc",
    allLangFilter: "All",
    allViewMode: "grid",  // "grid" or "list"
    isLoading: false,
    isFetching: {},     // track which categories are loading
};

// =========================================================================
// 2. CONSTANTS
// =========================================================================
const GITHUB_API = "https://api.github.com";

/* Category → GitHub search topic/query */
const CATEGORIES = {
    ai:       { label: "AI & ML",   query: "topic:machine-learning+topic:ai" },
    gaming:   { label: "Gaming",    query: "topic:game+topic:gaming" },
    design:   { label: "Design",    query: "topic:design+topic:css+topic:ui" },
    data:     { label: "Data",      query: "topic:data+topic:analytics+topic:visualization" },
    security: { label: "Security",  query: "topic:security+topic:cybersecurity" },
    finance:  { label: "Finance",   query: "topic:finance+topic:fintech+topic:crypto" },
    maps:     { label: "Maps",      query: "topic:maps+topic:geolocation+topic:gis" },
    music:    { label: "Music",     query: "topic:music+topic:audio+topic:spotify" },
};

const FAV_KEY = "devpulse_favs_v2";

// =========================================================================
// 3. DATA LAYER — fetching from GitHub API
// =========================================================================


async function fetchTrending() {
    try {
        showSearchLoader(true);
        const url = `${GITHUB_API}/search/repositories?q=stars:>50000&sort=stars&order=desc&per_page=30`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
        const data = await response.json();

        // Use Array.map() HOF to transform raw API data into our clean model
        STATE.trending = data.items.map(repo => transformRepo(repo));

        renderTrending();
        updateHeroStats();
        populateLangFilter();
    } catch (err) {
        console.error("Failed to fetch trending:", err);
        showToast("⚠️ Could not load GitHub data. Showing cached results.", "error");
        STATE.trending = getFallbackData();
        renderTrending();
        updateHeroStats();
        populateLangFilter();
    } finally {
        showSearchLoader(false);
    }
}

/**
 * fetchCategory:
 * Lazy-loads repos for a specific category chip.
 * Results are cached in STATE.categories so we don't re-fetch.
 */
async function fetchCategory(category) {
    // If already cached, just render — no extra API call
    if (STATE.categories[category]) {
        renderCategoryGrid(STATE.categories[category]);
        return;
    }
    if (STATE.isFetching[category]) return;
    STATE.isFetching[category] = true;

    const { query } = CATEGORIES[category];
    showCategoryLoader(true);

    try {
        const url = `${GITHUB_API}/search/repositories?q=${query}&sort=stars&order=desc&per_page=18`;
        const response = await fetch(url, { headers: { "Accept": "application/vnd.github+json" } });
        if (checkRateLimit(response)) {
            STATE.isFetching[category] = false;
            showCategoryLoader(false);
            return;
        }
        if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
        const data = await response.json();

        // Use Array.map() to transform each item
        STATE.categories[category] = data.items.map(repo => transformRepo(repo));
        renderCategoryGrid(STATE.categories[category]);
    } catch (err) {
        console.error(`Failed to fetch category ${category}:`, err);
        showToast("⚠️ Could not load category data.", "error");
        document.getElementById("catNoResults").classList.remove("hidden");
        document.getElementById("categoryGrid").innerHTML = "";
    } finally {
        STATE.isFetching[category] = false;
        showCategoryLoader(false);
    }
}

/**
 * transformRepo:
 * Converts raw GitHub API response into our clean internal model.
 * Calculates velocity = stars / days_since_creation
 */
function transformRepo(repo) {
    const createdAt = new Date(repo.created_at);
    const now = new Date();
    const daysSinceCreation = Math.max(1, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));

    // stars per day — this is our "velocity" metric
    const velocity = Math.round(repo.stargazers_count / daysSinceCreation);

    // Security: validate full_name is a safe github slug (owner/repo format, no special chars)
    const safeFullName = /^[\w.-]+\/[\w.-]+$/.test(repo.full_name) ? repo.full_name : "unknown/unknown";

    return {
        id: repo.id,
        full_name: safeFullName,
        name: repo.name,
        description: repo.description || "No description provided.",
        html_url: safeUrl(repo.html_url),   // Security: validate URL before storing
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        language: repo.language || "Unknown",
        topics: Array.isArray(repo.topics) ? repo.topics.filter(t => /^[\w-]+$/.test(t)) : [],
        pushed_at: repo.pushed_at,
        created_at: repo.created_at,
        velocity: velocity,  // ⚡ Stars per day
        daysSinceCreation: daysSinceCreation,
    };
}

// =========================================================================
// 4. RENDERING — VIEW FUNCTIONS
// =========================================================================


function renderTrending() {
    let repos = [...STATE.trending];

    // Sort using Array.sort() HOF
    repos = sortRepos(repos, STATE.trendingSort);

    // Render top 3 as podium cards
    const podium = repos.slice(0, 3);
    const list = repos.slice(3);  // ranks 4-30

    const rankSymbols = ["🥇", "🥈", "🥉"];
    const rankClasses = ["rank-1", "rank-2", "rank-3"];

    const podiumHTML = podium.map((repo, idx) =>
        `<div class="podium-card ${rankClasses[idx]}" data-action="open-modal" data-repo="${escapeAttr(repo.full_name)}">
            <span class="podium-rank">${rankSymbols[idx]}</span>
            <div class="podium-velocity">⚡ ${formatNumber(repo.velocity)} stars/day</div>
            <div class="podium-name">${escapeHtml(repo.full_name)}</div>
            <div class="podium-desc">${escapeHtml(repo.description)}</div>
            <div class="podium-meta">
                <span class="podium-stars">★ ${formatNumber(repo.stars)}</span>
                <span class="podium-lang">${escapeHtml(repo.language)}</span>
                <div class="podium-actions">
                    <button class="icon-btn copy-btn" data-action="copy-url" data-url="${safeUrl(repo.html_url)}" title="Copy URL">📋</button>
                    <button class="icon-btn fav-btn ${isFavorite(repo.full_name) ? 'active' : ''}"
                        data-action="toggle-fav" data-repo="${escapeAttr(repo.full_name)}" title="Save to favorites">
                        ${isFavorite(repo.full_name) ? '♥' : '♡'}
                    </button>
                    <a href="${safeUrl(repo.html_url)}" target="_blank" rel="noopener noreferrer"
                        class="btn-view-repo" data-action="external-link">GitHub ↗</a>
                </div>
            </div>
        </div>`
    ).join("");

    document.getElementById("podiumGrid").innerHTML = podiumHTML;

    // Render ranked list (4+)
    const listHTML = list.map((repo, idx) =>
        `<div class="trend-row" data-action="open-modal" data-repo="${escapeAttr(repo.full_name)}">
            <span class="trend-rank">${idx + 4}</span>
            <div class="trend-info">
                <div class="trend-name">${escapeHtml(repo.full_name)}</div>
                <div class="trend-desc">${escapeHtml(repo.description)}</div>
            </div>
            <span class="trend-velocity">⚡ ${formatNumber(repo.velocity)}/day</span>
            <span class="trend-stars">★ ${formatNumber(repo.stars)}</span>
            <button class="trend-fav-btn ${isFavorite(repo.full_name) ? 'active' : ''}"
                data-action="toggle-fav" data-repo="${escapeAttr(repo.full_name)}" title="Favorite">
                ${isFavorite(repo.full_name) ? '♥' : '♡'}
            </button>
        </div>`
    ).join("");

    document.getElementById("trendingList").innerHTML = listHTML;
}

/**
 * renderCategoryGrid:
 * Renders the category tab's repo grid using Array.map() HOF.
 */
function renderCategoryGrid(repos) {
    const grid = document.getElementById("categoryGrid");
    const noResults = document.getElementById("catNoResults");

    if (!repos || repos.length === 0) {
        grid.innerHTML = "";
        noResults.classList.remove("hidden");
        return;
    }
    noResults.classList.add("hidden");
    grid.innerHTML = repos.map(repo => buildRepoCard(repo)).join("");
}

/**
 * renderAllRepos:
 * Renders the "All Repos" tab with search, sort, and language filter.
 * Uses Array.filter(), Array.sort(), and Array.map() HOFs — this is the core HOF showcase!
 */
function renderAllRepos() {
    // Combine all data (trending + all cached categories)
    const allCacheRepos = Object.values(STATE.categories).flat();
    const allById = {};

    // Use spread to de-duplicate by repo ID
    [...STATE.trending, ...allCacheRepos].forEach(r => { allById[r.id] = r; });
    let repos = Object.values(allById);

    // 1. FILTER by search query using Array.filter() HOF
    if (STATE.searchQuery.trim()) {
        const q = STATE.searchQuery.toLowerCase();
        repos = repos.filter(r =>
            r.name.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.language.toLowerCase().includes(q) ||
            r.full_name.toLowerCase().includes(q)
        );
    }

    // 2. FILTER by language using Array.filter() HOF
    if (STATE.allLangFilter !== "All") {
        repos = repos.filter(r => r.language === STATE.allLangFilter);
    }

    // 3. SORT using Array.sort() HOF
    repos = sortRepos(repos, STATE.allSort);

    const grid = document.getElementById("allRepoGrid");
    const noResults = document.getElementById("allNoResults");

    if (repos.length === 0) {
        grid.innerHTML = "";
        noResults.classList.remove("hidden");
        return;
    }
    noResults.classList.add("hidden");
    grid.innerHTML = repos.map(repo => buildRepoCard(repo)).join("");
}

/**
 * renderFavorites:
 * Renders the favorites tab. Uses Array.filter() + Array.map() HOFs.
 */
function renderFavorites() {
    const grid = document.getElementById("favGrid");
    const emptyState = document.getElementById("favEmptyState");

    // Combine all available repos
    const allById = {};
    [...STATE.trending, ...Object.values(STATE.categories).flat()]
        .forEach(r => { allById[r.full_name] = r; });

    // Filter to only favorites using Array.filter() HOF
    const favRepos = STATE.favorites
        .map(fn => allById[fn])
        .filter(r => r !== undefined);

    grid.innerHTML = favRepos.map(repo => buildRepoCard(repo)).join("");

    const isEmpty = favRepos.length === 0;
    emptyState.classList.toggle("hidden", !isEmpty);

    // Update favorite count
    updateFavCount();
}

/**
 * buildRepoCard:
 * Pure function — takes a repo object, returns HTML string.
 */
function buildRepoCard(repo) {
    const favActive = isFavorite(repo.full_name);
    return `
        <div class="repo-card" data-action="open-modal" data-repo="${escapeAttr(repo.full_name)}">
            <div class="repo-card-top">
                <span class="repo-card-lang">${escapeHtml(repo.language)}</span>
                <span class="repo-velocity-badge">⚡ ${formatNumber(repo.velocity)}/day</span>
            </div>
            <div class="repo-card-name">${escapeHtml(repo.full_name)}</div>
            <div class="repo-card-desc">${escapeHtml(repo.description)}</div>
            <div class="repo-card-footer">
                <span class="repo-stars">★ ${formatNumber(repo.stars)}</span>
                <div class="repo-actions">
                    <button class="icon-btn copy-btn" data-action="copy-url" data-url="${safeUrl(repo.html_url)}" title="Copy URL">📋</button>
                    <button class="icon-btn fav-btn ${favActive ? 'active' : ''}"
                        data-action="toggle-fav" data-repo="${escapeAttr(repo.full_name)}" title="Save to favorites">
                        ${favActive ? '♥' : '♡'}
                    </button>
                    <a href="${safeUrl(repo.html_url)}" target="_blank" rel="noopener noreferrer"
                        class="btn-view-repo" data-action="external-link">View ↗</a>
                </div>
            </div>
        </div>
    `;
}

// =========================================================================
// 5. MODAL — Repo Detail
// =========================================================================

/**
 * openModal:
 * Finds a repo by full_name and displays it in the detail modal.
 * Uses Array.find() HOF.
 */
function openModal(fullName) {
    // Find repo in all available data using Array.find() HOF
    const allById = {};
    [...STATE.trending, ...Object.values(STATE.categories).flat()]
        .forEach(r => { allById[r.full_name] = r; });

    const repo = allById[fullName];
    if (!repo) return;

    const lastPushed = new Date(repo.pushed_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
    });
    const favActive = isFavorite(repo.full_name);

    document.getElementById("modalContent").innerHTML = `
        <div class="modal-header-top">
            <span class="repo-card-lang">${escapeHtml(repo.language)}</span>
            <span class="repo-velocity-badge">⚡ ${formatNumber(repo.velocity)} stars/day</span>
        </div>
        <h2 class="modal-title">${escapeHtml(repo.full_name)}</h2>
        <p class="modal-desc">${escapeHtml(repo.description)}</p>
        <div class="modal-stats">
            <div class="modal-stat">
                <span class="modal-stat-val">★ ${formatNumber(repo.stars)}</span>
                <span class="modal-stat-label">Stars</span>
            </div>
            <div class="modal-stat">
                <span class="modal-stat-val">⑂ ${formatNumber(repo.forks)}</span>
                <span class="modal-stat-label">Forks</span>
            </div>
            <div class="modal-stat">
                <span class="modal-stat-val">⚡ ${formatNumber(repo.velocity)}</span>
                <span class="modal-stat-label">Stars/Day</span>
            </div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-3);margin-bottom:1rem;text-align:center;">Last pushed: ${lastPushed}</p>
        <div class="modal-actions">
            <a href="${safeUrl(repo.html_url)}" target="_blank" rel="noopener noreferrer" class="modal-btn-primary" style="display:flex;align-items:center;justify-content:center;gap:0.5rem;text-decoration:none;">
                Open on GitHub ↗
            </a>
            <button class="modal-btn-secondary ${favActive ? 'active' : ''}"
                data-action="modal-toggle-fav" data-repo="${escapeAttr(repo.full_name)}">
                ${favActive ? '♥ Saved' : '♡ Save'}
            </button>
            <button class="modal-btn-secondary" data-action="copy-url" data-url="${safeUrl(repo.html_url)}" title="Copy URL">
                📋 Copy URL
            </button>
        </div>
    `;

    document.getElementById("repoModal").classList.add("open");
    document.getElementById("repoModal").setAttribute("aria-hidden", "false");
}

function closeModal() {
    document.getElementById("repoModal").classList.remove("open");
    document.getElementById("repoModal").setAttribute("aria-hidden", "true");
}

// =========================================================================
// 6. FAVORITES MANAGEMENT
// =========================================================================

function loadFavorites() {
    try {
        STATE.favorites = JSON.parse(localStorage.getItem(FAV_KEY)) || [];
    } catch {
        STATE.favorites = [];
    }
    updateFavCount();
}

function saveFavorites() {
    localStorage.setItem(FAV_KEY, JSON.stringify(STATE.favorites));
}

function isFavorite(fullName) {
    return STATE.favorites.includes(fullName);
}

/**
 * toggleFavorite:
 * Adds or removes a repo from favorites.
 * Uses Array.filter() HOF to remove, and spread to add.
 */
function toggleFavorite(event, fullName) {
    event.stopPropagation();
    if (isFavorite(fullName)) {
        // Remove using Array.filter() HOF
        STATE.favorites = STATE.favorites.filter(fn => fn !== fullName);
        showToast("Removed from favorites", "");
    } else {
        STATE.favorites = [...STATE.favorites, fullName];
        showToast("♥ Added to favorites!", "success");
    }
    saveFavorites();
    updateFavCount();

    // Re-render current active views so heart icons update
    if (STATE.activeTab === "trending") renderTrending();
    if (STATE.activeTab === "categories") renderCategoryGrid(STATE.categories[STATE.activeCategory] || []);
    if (STATE.activeTab === "all") renderAllRepos();
    if (STATE.activeTab === "favorites") renderFavorites();
}

function clearAllFavorites() {
    STATE.favorites = [];
    saveFavorites();
    renderFavorites();
    updateFavCount();
    showToast("Favorites cleared", "");
}

function updateFavCount() {
    const count = STATE.favorites.length;
    document.getElementById("favBadge").textContent = count;
    document.getElementById("hstatFavs").textContent = count;
}

// =========================================================================
// 7. SEARCH HANDLER
// =========================================================================

let searchTimer = null;
function handleSearch(query) {
    STATE.searchQuery = query;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        // If user is on trending, switch them to "all" for search
        if (STATE.activeTab === "trending" && query.trim()) {
            switchTab("all");
        }
        if (STATE.activeTab === "all") renderAllRepos();
        if (STATE.activeTab === "categories") {
            const catData = STATE.categories[STATE.activeCategory] || [];
            if (query.trim()) {
                const q = query.toLowerCase();
                const filtered = catData.filter(r =>
                    r.name.toLowerCase().includes(q) ||
                    r.description.toLowerCase().includes(q)
                );
                renderCategoryGrid(filtered);
            } else {
                renderCategoryGrid(catData);
            }
        }
    }, 350); // debounce: 350ms
}

// =========================================================================
// 8. SORTING HELPERS
// =========================================================================

/**
 * sortRepos:
 * Pure function that returns a new sorted array using Array.sort() HOF.
 */
function sortRepos(repos, sortKey) {
    return [...repos].sort((a, b) => {
        switch (sortKey) {
            case "velocity":   return b.velocity - a.velocity;
            case "stars-desc": return b.stars - a.stars;
            case "stars-asc":  return a.stars - b.stars;
            case "name-asc":   return a.name.localeCompare(b.name);
            case "name-desc":  return b.name.localeCompare(a.name);
            case "recent":     return new Date(b.pushed_at) - new Date(a.pushed_at);
            default:           return b.stars - a.stars;
        }
    });
}

// =========================================================================
// 9. TAB NAVIGATION
// =========================================================================

function switchTab(tabId) {
    STATE.activeTab = tabId;

    // Update tab buttons
    document.querySelectorAll(".nav-tab").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    // Update content views
    document.querySelectorAll(".tab-content").forEach(view => {
        view.classList.toggle("active", view.id === `view-${tabId}`);
    });

    // Lazy-load data for tabs
    if (tabId === "categories") {
        fetchCategory(STATE.activeCategory);
    }
    if (tabId === "all") {
        renderAllRepos();
    }
    if (tabId === "favorites") {
        renderFavorites();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================================================
// 10. HERO STATS
// =========================================================================

function updateHeroStats() {
    const total = STATE.trending.length;
    document.getElementById("hstatTotal").textContent = total + "+";
}

// =========================================================================
// 11. LANGUAGE FILTER POPULATION
// =========================================================================

function populateLangFilter() {
    // Use Array.map() + Set to get unique languages
    const langs = ["All", ...new Set(STATE.trending.map(r => r.language).filter(Boolean).sort())];
    const select = document.getElementById("langFilter");
    select.innerHTML = langs.map(l => `<option value="${l}">${l}</option>`).join("");
}

// =========================================================================
// 12. UI UTILITIES
// =========================================================================

function showToast(message, type = "") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

function showSearchLoader(show) {
    document.getElementById("searchLoader").classList.toggle("hidden", !show);
}

function showCategoryLoader(show) {
    if (show) {
        document.getElementById("categoryGrid").innerHTML =
            Array(6).fill('<div class="loading-skeleton"></div>').join("");
    }
}

function formatNumber(n) {
    if (n === undefined || n === null) return "0";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return n.toString();
}

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Escape a string to use inside an HTML attribute safely */
function escapeAttr(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

/**
 * safeUrl:
 * Security: validates that a URL is a legitimate https://github.com URL.
 * Prevents open-redirect or javascript: injection in anchor hrefs.
 */
function safeUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        // Only allow HTTPS links to github.com
        if (url.protocol === "https:" && url.hostname === "github.com") {
            return url.href;
        }
    } catch (_) { /* invalid URL */ }
    return "https://github.com";  // safe fallback
}

/**
 * isRateLimited:
 * Security: checks response headers for GitHub API rate limiting.
 * Shows a user-friendly error instead of silently failing.
 */
function checkRateLimit(response) {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    if (remaining !== null && parseInt(remaining, 10) === 0) {
        const reset = response.headers.get("X-RateLimit-Reset");
        const resetTime = reset ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString() : "soon";
        showToast(`⚠️ GitHub API rate limit hit. Resets at ${resetTime}.`, "error");
        return true;
    }
    return false;
}

function clearAllFilters() {
    document.getElementById("globalSearch").value = "";
    STATE.searchQuery = "";
    STATE.allLangFilter = "All";
    document.getElementById("langFilter").value = "All";
    renderAllRepos();
}

// =========================================================================
// 13. FALLBACK DATA (if API fails or rate-limited)
// =========================================================================

function getFallbackData() {
    const fallback = [
        { id: 1, full_name: "microsoft/vscode", name: "vscode", description: "Visual Studio Code — the most popular open-source code editor.", html_url: "https://github.com/microsoft/vscode", stars: 165000, forks: 30000, watchers: 165000, language: "TypeScript", topics: ["editor"], pushed_at: "2024-01-01", created_at: "2015-09-03", velocity: 120 },
        { id: 2, full_name: "torvalds/linux", name: "linux", description: "Linux kernel source tree.", html_url: "https://github.com/torvalds/linux", stars: 180000, forks: 55000, watchers: 180000, language: "C", topics: ["os"], pushed_at: "2024-01-01", created_at: "2011-09-04", velocity: 45 },
        { id: 3, full_name: "freeCodeCamp/freeCodeCamp", name: "freeCodeCamp", description: "Learn to code for free — the open source curriculum.", html_url: "https://github.com/freeCodeCamp/freeCodeCamp", stars: 395000, forks: 35000, watchers: 395000, language: "TypeScript", topics: ["education"], pushed_at: "2024-01-01", created_at: "2014-12-24", velocity: 101 },
        { id: 4, full_name: "tensorflow/tensorflow", name: "tensorflow", description: "An Open Source Machine Learning Framework for Everyone.", html_url: "https://github.com/tensorflow/tensorflow", stars: 185000, forks: 75000, watchers: 185000, language: "C++", topics: ["ai"], pushed_at: "2024-01-01", created_at: "2015-11-07", velocity: 50 },
        { id: 5, full_name: "vuejs/vue", name: "vue", description: "The Progressive JavaScript Framework.", html_url: "https://github.com/vuejs/vue", stars: 207000, forks: 34000, watchers: 207000, language: "JavaScript", topics: ["framework"], pushed_at: "2024-01-01", created_at: "2013-07-29", velocity: 54 },
        { id: 6, full_name: "facebook/react", name: "react", description: "The library for web and native user interfaces.", html_url: "https://github.com/facebook/react", stars: 225000, forks: 46000, watchers: 225000, language: "JavaScript", topics: ["ui"], pushed_at: "2024-01-01", created_at: "2013-05-24", velocity: 59 },
    ];
    return fallback.map(r => ({ ...r, daysSinceCreation: 3000 }));
}

// =========================================================================
// 14. EVENT LISTENERS — wiring everything together
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {

    // Load saved favorites from localStorage
    loadFavorites();

    // Fetch initial trending data
    fetchTrending();

    /* ––– Tab clicks ––– */
    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    /* ––– Logo → go to trending ––– */
    document.getElementById("logoBtn").addEventListener("click", (e) => {
        e.preventDefault();
        switchTab("trending");
    });

    /* ––– Favorites nav button ––– */
    document.getElementById("favNavBtn").addEventListener("click", () => switchTab("favorites"));

    /* ––– Global Search ––– */
    document.getElementById("globalSearch").addEventListener("input", (e) => {
        handleSearch(e.target.value);
    });

    /* ––– Trending sort ––– */
    document.getElementById("trendingSort").addEventListener("change", (e) => {
        // Map select value to sort key used in sortRepos()
        const val = e.target.value;
        STATE.trendingSort = val === "stars" ? "stars-desc" : val;
        renderTrending();
    });

    /* ––– Category chips ––– */
    document.getElementById("categoryChips").addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;

        document.querySelectorAll("#categoryChips .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        STATE.activeCategory = chip.dataset.category;
        fetchCategory(STATE.activeCategory);
    });

    /* ––– Language filter (All tab) ––– */
    document.getElementById("langFilter").addEventListener("change", (e) => {
        STATE.allLangFilter = e.target.value;
        renderAllRepos();
    });

    /* ––– Sort (All tab) ––– */
    document.getElementById("allSort").addEventListener("change", (e) => {
        STATE.allSort = e.target.value;
        renderAllRepos();
    });

    /* ––– View toggle grid/list ––– */
    document.getElementById("gridBtn").addEventListener("click", () => {
        STATE.allViewMode = "grid";
        document.getElementById("allRepoGrid").classList.remove("list-mode");
        document.getElementById("gridBtn").classList.add("active");
        document.getElementById("listBtn").classList.remove("active");
    });
    document.getElementById("listBtn").addEventListener("click", () => {
        STATE.allViewMode = "list";
        document.getElementById("allRepoGrid").classList.add("list-mode");
        document.getElementById("listBtn").classList.add("active");
        document.getElementById("gridBtn").classList.remove("active");
    });

    /* ––– Modal close ––– */
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("repoModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("repoModal")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });

    /* ––– Back to top button ––– */
    const fabBtn = document.getElementById("backToTop");
    window.addEventListener("scroll", () => {
        fabBtn.classList.toggle("hidden", window.scrollY < 400);
    });
    fabBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    /* ––– Theme toggle ––– */
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");
    const savedTheme = localStorage.getItem("devpulse_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    themeIcon.textContent = savedTheme === "dark" ? "☽" : "☀";

    themeToggle.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        themeIcon.textContent = next === "dark" ? "☽" : "☀";
        localStorage.setItem("devpulse_theme", next);
    });

    /* ═══════════════════════════════════════════════════════════════════
     * EVENT DELEGATION — handles all data-action clicks on dynamically
     * rendered cards (replaces all forbidden inline onclick= handlers)
     * ═══════════════════════════════════════════════════════════════════ */
    document.addEventListener("click", (e) => {
        // ── Toggle favorite (card buttons + modal save button) ──
        const favBtn = e.target.closest("[data-action='toggle-fav']");
        if (favBtn) {
            e.stopPropagation();
            const repo = favBtn.dataset.repo;
            if (repo) toggleFavorite(e, repo);
            return;
        }

        // ── Modal save button ──
        const modalFavBtn = e.target.closest("[data-action='modal-toggle-fav']");
        if (modalFavBtn) {
            e.stopPropagation();
            const repo = modalFavBtn.dataset.repo;
            if (repo) {
                toggleFavorite(e, repo);
                const saved = isFavorite(repo);
                modalFavBtn.innerHTML = saved ? "♥ Saved" : "♡ Save";
                modalFavBtn.classList.toggle("active", saved);
            }
            return;
        }

        // ── External links — stop propagation so card modal doesn't open ──
        const extLink = e.target.closest("[data-action='external-link']");
        if (extLink) {
            e.stopPropagation();
            return; // browser handles the <a> href normally
        }

        // ── Open modal on card/row click ──
        const card = e.target.closest("[data-action='open-modal']");
        if (card) {
            const repo = card.dataset.repo;
            if (repo) openModal(repo);
        }

        // ── Copy URL ──
        const copyBtn = e.target.closest("[data-action='copy-url']");
        if (copyBtn) {
            e.stopPropagation();
            const url = copyBtn.dataset.url;
            if (url) {
                navigator.clipboard.writeText(url).then(() => {
                    showToast("Copied to clipboard!", "success");
                }).catch(() => {
                    showToast("Failed to copy", "error");
                });
            }
        }
    });
});
