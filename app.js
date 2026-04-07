
// =========================================================================
// 1. STATE — single object holding all the app's data
// =========================================================================
const STATE = {
    trending:       [],   // top 30 trending repos
    categories:     {},   // { ai: [...], gaming: [...], ... } cached per tab
    favorites:      [],   // array of repo full_names from localStorage
    activeTab:      "trending",
    activeCategory: "ai",
    searchQuery:    "",
    trendingSort:   "velocity",
    allSort:        "stars-desc",
    allLangFilter:  "All",
    allViewMode:    "grid",
    isFetching:     {},   // tracks which categories are currently loading
};

// =========================================================================
// 2. CONSTANTS
// =========================================================================
const GITHUB_API = "https://api.github.com";
const FAV_KEY    = "devpulse_favs_v2";

// Category → GitHub search query
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

// =========================================================================
// 3. DATA — fetching from GitHub API
// =========================================================================

async function fetchTrending() {
    showSearchLoader(true);
    try {
        const url = GITHUB_API + "/search/repositories?q=stars:>50000&sort=stars&order=desc&per_page=30";
        const res  = await fetch(url);
        if (!res.ok) throw new Error("GitHub API error: " + res.status);
        const data = await res.json();

        // map() turns each raw API item into our clean repo object
        STATE.trending = data.items.map(item => makeRepo(item));

        renderTrending();
        updateHeroStats();
        populateLangFilter();
    } catch (err) {
        console.error("fetchTrending failed:", err);
        showToast("⚠️ Could not load GitHub data. Showing cached results.", "error");
        STATE.trending = getFallbackData();
        renderTrending();
        updateHeroStats();
        populateLangFilter();
    }
    showSearchLoader(false);
}

async function fetchCategory(category) {
    // If we already have the data cached, just render it — no extra API call
    if (STATE.categories[category]) {
        renderCategoryGrid(STATE.categories[category]);
        return;
    }
    // If a fetch is already in progress, do nothing
    if (STATE.isFetching[category]) return;
    STATE.isFetching[category] = true;

    const query = CATEGORIES[category].query;
    showCategoryLoader(true);

    try {
        const url = GITHUB_API + "/search/repositories?q=" + query + "&sort=stars&order=desc&per_page=18";
        const res  = await fetch(url);
        if (!res.ok) throw new Error("GitHub API error: " + res.status);
        const data = await res.json();

        // map() turns each item into our clean repo object
        STATE.categories[category] = data.items.map(item => makeRepo(item));
        renderCategoryGrid(STATE.categories[category]);
    } catch (err) {
        console.error("fetchCategory failed for " + category + ":", err);
        showToast("⚠️ Could not load category data.", "error");
        document.getElementById("catNoResults").classList.remove("hidden");
        document.getElementById("categoryGrid").innerHTML = "";
    }
    STATE.isFetching[category] = false;
    showCategoryLoader(false);
}

// makeRepo: converts a raw GitHub API item into our clean object
// also calculates "velocity" = stars per day since the repo was created
function makeRepo(item) {
    const created      = new Date(item.created_at);
    const now          = new Date();
    const days         = Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
    const velocity     = Math.round(item.stargazers_count / days);

    return {
        id:          item.id,
        full_name:   item.full_name,
        name:        item.name,
        description: item.description || "No description provided.",
        html_url:    item.html_url,
        stars:       item.stargazers_count,
        forks:       item.forks_count,
        watchers:    item.watchers_count,
        language:    item.language || "Unknown",
        topics:      Array.isArray(item.topics) ? item.topics : [],
        pushed_at:   item.pushed_at,
        created_at:  item.created_at,
        velocity:    velocity,
        days:        days,
    };
}

// =========================================================================
// 4. RENDERING — building the HTML on screen
// =========================================================================

function renderTrending() {
    // Sort the repos by the active sort key
    let repos = sortRepos(STATE.trending, STATE.trendingSort);

    // Top 3 get the podium cards
    const top3 = repos.slice(0, 3);
    const rest  = repos.slice(3);

    const medals  = ["🥇", "🥈", "🥉"];
    const classes = ["rank-1", "rank-2", "rank-3"];

    // Use map() to build the HTML string for each podium card
    const podiumHTML = top3.map(function(repo, i) {
        return `<div class="podium-card ${classes[i]}" data-action="open-modal" data-repo="${repo.full_name}">
            <span class="podium-rank">${medals[i]}</span>
            <div class="podium-velocity">⚡ ${formatNum(repo.velocity)} stars/day</div>
            <div class="podium-name">${repo.full_name}</div>
            <div class="podium-desc">${repo.description}</div>
            <div class="podium-meta">
                <span class="podium-stars">★ ${formatNum(repo.stars)}</span>
                <span class="podium-lang">${repo.language}</span>
                <div class="podium-actions">
                    <button class="icon-btn copy-btn" data-action="copy-url" data-url="${repo.html_url}" title="Copy URL">📋</button>
                    <button class="icon-btn fav-btn ${isFav(repo.full_name) ? 'active' : ''}"
                        data-action="toggle-fav" data-repo="${repo.full_name}" title="Save to favorites">
                        ${isFav(repo.full_name) ? '♥' : '♡'}
                    </button>
                    <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer"
                        class="btn-view-repo" data-action="external-link">GitHub ↗</a>
                </div>
            </div>
        </div>`;
    }).join("");

    document.getElementById("podiumGrid").innerHTML = podiumHTML;

    // Ranks 4–30 get a compact list row
    const listHTML = rest.map(function(repo, i) {
        return `<div class="trend-row" data-action="open-modal" data-repo="${repo.full_name}">
            <span class="trend-rank">${i + 4}</span>
            <div class="trend-info">
                <div class="trend-name">${repo.full_name}</div>
                <div class="trend-desc">${repo.description}</div>
            </div>
            <span class="trend-velocity">⚡ ${formatNum(repo.velocity)}/day</span>
            <span class="trend-stars">★ ${formatNum(repo.stars)}</span>
            <button class="trend-fav-btn ${isFav(repo.full_name) ? 'active' : ''}"
                data-action="toggle-fav" data-repo="${repo.full_name}" title="Favorite">
                ${isFav(repo.full_name) ? '♥' : '♡'}
            </button>
        </div>`;
    }).join("");

    document.getElementById("trendingList").innerHTML = listHTML;
}

function renderCategoryGrid(repos) {
    const grid      = document.getElementById("categoryGrid");
    const noResults = document.getElementById("catNoResults");

    if (!repos || repos.length === 0) {
        grid.innerHTML = "";
        noResults.classList.remove("hidden");
        return;
    }
    noResults.classList.add("hidden");

    // map() turns each repo into a card HTML string
    grid.innerHTML = repos.map(repo => buildCard(repo)).join("");
}

function renderAllRepos() {
    // Build one big list from trending + all cached categories, removing duplicates by id
    const byId = {};
    STATE.trending.forEach(r => { byId[r.id] = r; });
    Object.values(STATE.categories).forEach(function(list) {
        list.forEach(r => { byId[r.id] = r; });
    });
    let repos = Object.values(byId);

    // 1. filter() by search query
    if (STATE.searchQuery.trim()) {
        const q = STATE.searchQuery.toLowerCase();
        repos = repos.filter(function(r) {
            return r.name.toLowerCase().includes(q)
                || r.description.toLowerCase().includes(q)
                || r.language.toLowerCase().includes(q)
                || r.full_name.toLowerCase().includes(q);
        });
    }

    // 2. filter() by language
    if (STATE.allLangFilter !== "All") {
        repos = repos.filter(r => r.language === STATE.allLangFilter);
    }

    // 3. sort()
    repos = sortRepos(repos, STATE.allSort);

    const grid      = document.getElementById("allRepoGrid");
    const noResults = document.getElementById("allNoResults");

    if (repos.length === 0) {
        grid.innerHTML = "";
        noResults.classList.remove("hidden");
        return;
    }
    noResults.classList.add("hidden");

    // map() each repo into a card
    grid.innerHTML = repos.map(repo => buildCard(repo)).join("");
}

function renderFavorites() {
    const grid       = document.getElementById("favGrid");
    const emptyState = document.getElementById("favEmptyState");

    // Build a lookup of all repos we know about
    const byName = {};
    STATE.trending.forEach(r => { byName[r.full_name] = r; });
    Object.values(STATE.categories).forEach(function(list) {
        list.forEach(r => { byName[r.full_name] = r; });
    });

    // map() favorites list → repo objects, then filter() out any we don't have data for
    const favRepos = STATE.favorites
        .map(name => byName[name])
        .filter(r => r !== undefined);

    grid.innerHTML = favRepos.map(repo => buildCard(repo)).join("");

    const isEmpty = favRepos.length === 0;
    emptyState.classList.toggle("hidden", !isEmpty);

    updateFavCount();
}

// buildCard: takes one repo object, returns an HTML string for a card
function buildCard(repo) {
    const favActive = isFav(repo.full_name);
    return `
        <div class="repo-card" data-action="open-modal" data-repo="${repo.full_name}">
            <div class="repo-card-top">
                <span class="repo-card-lang">${repo.language}</span>
                <span class="repo-velocity-badge">⚡ ${formatNum(repo.velocity)}/day</span>
            </div>
            <div class="repo-card-name">${repo.full_name}</div>
            <div class="repo-card-desc">${repo.description}</div>
            <div class="repo-card-footer">
                <span class="repo-stars">★ ${formatNum(repo.stars)}</span>
                <div class="repo-actions">
                    <button class="icon-btn copy-btn" data-action="copy-url" data-url="${repo.html_url}" title="Copy URL">📋</button>
                    <button class="icon-btn fav-btn ${favActive ? 'active' : ''}"
                        data-action="toggle-fav" data-repo="${repo.full_name}" title="Save to favorites">
                        ${favActive ? '♥' : '♡'}
                    </button>
                    <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer"
                        class="btn-view-repo" data-action="external-link">View ↗</a>
                </div>
            </div>
        </div>
    `;
}

// =========================================================================
// 5. MODAL — popup detail card
// =========================================================================

function openModal(fullName) {
    // Find the repo in all known data using find()
    const byName = {};
    STATE.trending.forEach(r => { byName[r.full_name] = r; });
    Object.values(STATE.categories).forEach(function(list) {
        list.forEach(r => { byName[r.full_name] = r; });
    });

    const repo = byName[fullName];
    if (!repo) return;  // repo not found — do nothing

    const lastPushed = new Date(repo.pushed_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
    });
    const favActive = isFav(repo.full_name);

    document.getElementById("modalContent").innerHTML = `
        <div class="modal-header-top">
            <span class="repo-card-lang">${repo.language}</span>
            <span class="repo-velocity-badge">⚡ ${formatNum(repo.velocity)} stars/day</span>
        </div>
        <h2 class="modal-title">${repo.full_name}</h2>
        <p class="modal-desc">${repo.description}</p>
        <div class="modal-stats">
            <div class="modal-stat">
                <span class="modal-stat-val">★ ${formatNum(repo.stars)}</span>
                <span class="modal-stat-label">Stars</span>
            </div>
            <div class="modal-stat">
                <span class="modal-stat-val">⑂ ${formatNum(repo.forks)}</span>
                <span class="modal-stat-label">Forks</span>
            </div>
            <div class="modal-stat">
                <span class="modal-stat-val">⚡ ${formatNum(repo.velocity)}</span>
                <span class="modal-stat-label">Stars/Day</span>
            </div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-3);margin-bottom:1rem;text-align:center;">Last pushed: ${lastPushed}</p>
        <div class="modal-actions">
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="modal-btn-primary">
                Open on GitHub ↗
            </a>
            <button class="modal-btn-secondary ${favActive ? 'active' : ''}"
                data-action="modal-toggle-fav" data-repo="${repo.full_name}">
                ${favActive ? '♥ Saved' : '♡ Save'}
            </button>
            <button class="modal-btn-secondary" data-action="copy-url" data-url="${repo.html_url}" title="Copy URL">
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
// 6. FAVORITES
// =========================================================================

function loadFavorites() {
    try {
        STATE.favorites = JSON.parse(localStorage.getItem(FAV_KEY)) || [];
    } catch (e) {
        STATE.favorites = [];
    }
    updateFavCount();
}

function saveFavorites() {
    localStorage.setItem(FAV_KEY, JSON.stringify(STATE.favorites));
}

function isFav(fullName) {
    return STATE.favorites.includes(fullName);
}

function toggleFavorite(event, fullName) {
    event.stopPropagation();  // stop the card click from also triggering

    if (isFav(fullName)) {
        // filter() keeps everything EXCEPT the one we're removing
        STATE.favorites = STATE.favorites.filter(name => name !== fullName);
        showToast("Removed from favorites", "");
    } else {
        STATE.favorites.push(fullName);
        showToast("♥ Added to favorites!", "success");
    }

    saveFavorites();
    updateFavCount();

    // Re-render whichever tab is active so heart icons update instantly
    if (STATE.activeTab === "trending")   renderTrending();
    if (STATE.activeTab === "categories") renderCategoryGrid(STATE.categories[STATE.activeCategory] || []);
    if (STATE.activeTab === "all")        renderAllRepos();
    if (STATE.activeTab === "favorites")  renderFavorites();
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
    document.getElementById("favBadge").textContent  = count;
    document.getElementById("hstatFavs").textContent = count;
}

// =========================================================================
// 7. SEARCH
// =========================================================================

let searchTimer = null;

function handleSearch(query) {
    STATE.searchQuery = query;
    clearTimeout(searchTimer);

    // wait 350ms after user stops typing before running (debounce)
    searchTimer = setTimeout(function() {
        // if user is on trending and types something, move them to All Repos
        if (STATE.activeTab === "trending" && query.trim()) {
            switchTab("all");
        }
        if (STATE.activeTab === "all") {
            renderAllRepos();
        }
        if (STATE.activeTab === "categories") {
            const catData = STATE.categories[STATE.activeCategory] || [];
            if (query.trim()) {
                const q = query.toLowerCase();
                const filtered = catData.filter(function(r) {
                    return r.name.toLowerCase().includes(q)
                        || r.description.toLowerCase().includes(q);
                });
                renderCategoryGrid(filtered);
            } else {
                renderCategoryGrid(catData);
            }
        }
    }, 350);
}

// =========================================================================
// 8. SORTING
// =========================================================================

// sortRepos: takes an array + a sort key, returns a new sorted array
// uses sort() which accepts a comparison function
function sortRepos(repos, sortKey) {
    return [...repos].sort(function(a, b) {
        if (sortKey === "velocity")   return b.velocity - a.velocity;
        if (sortKey === "stars-desc") return b.stars - a.stars;
        if (sortKey === "stars-asc")  return a.stars - b.stars;
        if (sortKey === "name-asc")   return a.name.localeCompare(b.name);
        if (sortKey === "name-desc")  return b.name.localeCompare(a.name);
        if (sortKey === "recent")     return new Date(b.pushed_at) - new Date(a.pushed_at);
        return b.stars - a.stars; // default
    });
}

// =========================================================================
// 9. TAB NAVIGATION
// =========================================================================

function switchTab(tabId) {
    STATE.activeTab = tabId;

    // Update which tab button looks active
    document.querySelectorAll(".nav-tab").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    // Show the matching tab content, hide others
    document.querySelectorAll(".tab-content").forEach(function(view) {
        view.classList.toggle("active", view.id === "view-" + tabId);
    });

    // Load data for the tab if needed
    if (tabId === "categories") fetchCategory(STATE.activeCategory);
    if (tabId === "all")        renderAllRepos();
    if (tabId === "favorites")  renderFavorites();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================================================
// 10. HERO STATS + LANGUAGE FILTER
// =========================================================================

function updateHeroStats() {
    document.getElementById("hstatTotal").textContent = STATE.trending.length + "+";
}

function populateLangFilter() {
    // get all languages, remove duplicates with Set, sort alphabetically
    const allLangs  = STATE.trending.map(r => r.language).filter(Boolean);
    const uniqueLangs = ["All", ...new Set(allLangs.sort())];
    const select    = document.getElementById("langFilter");
    select.innerHTML = uniqueLangs.map(l => `<option value="${l}">${l}</option>`).join("");
}

// =========================================================================
// 11. UI UTILITIES
// =========================================================================

function showToast(message, type) {
    const container = document.getElementById("toastContainer");
    const toast     = document.createElement("div");
    toast.className = "toast " + (type || "");
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3500);
}

function showSearchLoader(show) {
    document.getElementById("searchLoader").classList.toggle("hidden", !show);
}

function showCategoryLoader(show) {
    if (show) {
        const skeletons = Array(6).fill('<div class="loading-skeleton"></div>').join("");
        document.getElementById("categoryGrid").innerHTML = skeletons;
    }
}

// formatNum: turns 165000 → "165.0k"
function formatNum(n) {
    if (n === undefined || n === null) return "0";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
}

function clearAllFilters() {
    document.getElementById("globalSearch").value = "";
    STATE.searchQuery   = "";
    STATE.allLangFilter = "All";
    document.getElementById("langFilter").value = "All";
    renderAllRepos();
}

// =========================================================================
// 12. FALLBACK DATA (shown when GitHub API is unavailable)
// =========================================================================

function getFallbackData() {
    return [
        { id: 1, full_name: "microsoft/vscode",              name: "vscode",        description: "Visual Studio Code — the most popular open-source code editor.", html_url: "https://github.com/microsoft/vscode",              stars: 165000, forks: 30000, watchers: 165000, language: "TypeScript", topics: [],         pushed_at: "2024-01-01", created_at: "2015-09-03", velocity: 120, days: 3000 },
        { id: 2, full_name: "torvalds/linux",                name: "linux",         description: "Linux kernel source tree.",                                        html_url: "https://github.com/torvalds/linux",                stars: 180000, forks: 55000, watchers: 180000, language: "C",          topics: [],         pushed_at: "2024-01-01", created_at: "2011-09-04", velocity: 45,  days: 4500 },
        { id: 3, full_name: "freeCodeCamp/freeCodeCamp",     name: "freeCodeCamp",  description: "Learn to code for free — the open source curriculum.",             html_url: "https://github.com/freeCodeCamp/freeCodeCamp",     stars: 395000, forks: 35000, watchers: 395000, language: "TypeScript", topics: [],         pushed_at: "2024-01-01", created_at: "2014-12-24", velocity: 101, days: 3300 },
        { id: 4, full_name: "tensorflow/tensorflow",         name: "tensorflow",    description: "An Open Source Machine Learning Framework for Everyone.",          html_url: "https://github.com/tensorflow/tensorflow",         stars: 185000, forks: 75000, watchers: 185000, language: "C++",        topics: ["ai"],     pushed_at: "2024-01-01", created_at: "2015-11-07", velocity: 50,  days: 3100 },
        { id: 5, full_name: "vuejs/vue",                     name: "vue",           description: "The Progressive JavaScript Framework.",                            html_url: "https://github.com/vuejs/vue",                     stars: 207000, forks: 34000, watchers: 207000, language: "JavaScript", topics: [],         pushed_at: "2024-01-01", created_at: "2013-07-29", velocity: 54,  days: 3800 },
        { id: 6, full_name: "facebook/react",                name: "react",         description: "The library for web and native user interfaces.",                  html_url: "https://github.com/facebook/react",                stars: 225000, forks: 46000, watchers: 225000, language: "JavaScript", topics: ["ui"],     pushed_at: "2024-01-01", created_at: "2013-05-24", velocity: 59,  days: 3900 },
    ];
}

// =========================================================================
// 13. EVENT LISTENERS — wires all UI interactions together
// =========================================================================

document.addEventListener("DOMContentLoaded", function() {

    // Load saved favorites from localStorage first
    loadFavorites();

    // Fetch trending repos from GitHub
    fetchTrending();

    // Tab buttons
    document.querySelectorAll(".nav-tab").forEach(function(tab) {
        tab.addEventListener("click", function() {
            switchTab(tab.dataset.tab);
        });
    });

    // Logo → go to trending tab
    document.getElementById("logoBtn").addEventListener("click", function(e) {
        e.preventDefault();
        switchTab("trending");
    });

    // Favorites button in navbar
    document.getElementById("favNavBtn").addEventListener("click", function() {
        switchTab("favorites");
    });

    // Search box
    document.getElementById("globalSearch").addEventListener("input", function(e) {
        handleSearch(e.target.value);
    });

    // Trending sort dropdown
    document.getElementById("trendingSort").addEventListener("change", function(e) {
        const val = e.target.value;
        // "stars" from the dropdown maps to "stars-desc" in sortRepos
        STATE.trendingSort = (val === "stars") ? "stars-desc" : val;
        renderTrending();
    });

    // Category chips
    document.getElementById("categoryChips").addEventListener("click", function(e) {
        const chip = e.target.closest(".chip");
        if (!chip) return;

        // Remove active from all chips, add to clicked one
        document.querySelectorAll("#categoryChips .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        STATE.activeCategory = chip.dataset.category;
        fetchCategory(STATE.activeCategory);
    });

    // Language filter (All Repos tab)
    document.getElementById("langFilter").addEventListener("change", function(e) {
        STATE.allLangFilter = e.target.value;
        renderAllRepos();
    });

    // Sort dropdown (All Repos tab)
    document.getElementById("allSort").addEventListener("change", function(e) {
        STATE.allSort = e.target.value;
        renderAllRepos();
    });

    // Grid / List view toggle
    document.getElementById("gridBtn").addEventListener("click", function() {
        STATE.allViewMode = "grid";
        document.getElementById("allRepoGrid").classList.remove("list-mode");
        document.getElementById("gridBtn").classList.add("active");
        document.getElementById("listBtn").classList.remove("active");
    });
    document.getElementById("listBtn").addEventListener("click", function() {
        STATE.allViewMode = "list";
        document.getElementById("allRepoGrid").classList.add("list-mode");
        document.getElementById("listBtn").classList.add("active");
        document.getElementById("gridBtn").classList.remove("active");
    });

    // Modal close button
    document.getElementById("modalClose").addEventListener("click", closeModal);

    // Click outside modal to close
    document.getElementById("repoModal").addEventListener("click", function(e) {
        if (e.target === document.getElementById("repoModal")) closeModal();
    });

    // Escape key closes modal
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") closeModal();
    });

    // Clear Filters button (All Repos tab)
    document.getElementById("clearFiltersBtn").addEventListener("click", clearAllFilters);

    // Clear All Favorites button
    document.getElementById("clearFavsBtn").addEventListener("click", clearAllFavorites);

    // "Explore Trending" button on empty favorites screen
    document.getElementById("exploreBtn").addEventListener("click", function() {
        switchTab("trending");
    });

    // Back to top button
    const fab = document.getElementById("backToTop");
    window.addEventListener("scroll", function() {
        fab.classList.toggle("hidden", window.scrollY < 400);
    });
    fab.addEventListener("click", function() {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Theme toggle (dark / light)
    const themeToggle = document.getElementById("themeToggle");
    const themeIcon   = document.getElementById("themeIcon");
    const savedTheme  = localStorage.getItem("devpulse_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    themeIcon.textContent = (savedTheme === "dark") ? "☽" : "☀";

    themeToggle.addEventListener("click", function() {
        const current = document.documentElement.getAttribute("data-theme");
        const next    = (current === "dark") ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        themeIcon.textContent = (next === "dark") ? "☽" : "☀";
        localStorage.setItem("devpulse_theme", next);
    });

    // ── EVENT DELEGATION ──────────────────────────────────────────────────
    // Instead of adding a click listener to every card, we add ONE listener
    // to the whole document and check what was clicked using data-action.
    document.addEventListener("click", function(e) {

        // Favorite toggle (on cards and trend rows)
        const favBtn = e.target.closest("[data-action='toggle-fav']");
        if (favBtn) {
            const repo = favBtn.dataset.repo;
            if (repo) toggleFavorite(e, repo);
            return;
        }

        // Favorite toggle inside the modal
        const modalFavBtn = e.target.closest("[data-action='modal-toggle-fav']");
        if (modalFavBtn) {
            e.stopPropagation();
            const repo = modalFavBtn.dataset.repo;
            if (repo) {
                toggleFavorite(e, repo);
                const saved = isFav(repo);
                modalFavBtn.innerHTML = saved ? "♥ Saved" : "♡ Save";
                modalFavBtn.classList.toggle("active", saved);
            }
            return;
        }

        // External link (GitHub ↗) — let the <a> tag handle it normally
        const extLink = e.target.closest("[data-action='external-link']");
        if (extLink) {
            e.stopPropagation();
            return;
        }

        // Copy URL to clipboard
        const copyBtn = e.target.closest("[data-action='copy-url']");
        if (copyBtn) {
            e.stopPropagation();
            const url = copyBtn.dataset.url;
            if (url) {
                navigator.clipboard.writeText(url)
                    .then(function()  { showToast("Copied to clipboard!", "success"); })
                    .catch(function() { showToast("Failed to copy", "error"); });
            }
            return;  // don't also open the modal
        }

        // Open modal when a card or trend-row is clicked
        const card = e.target.closest("[data-action='open-modal']");
        if (card) {
            const repo = card.dataset.repo;
            if (repo) openModal(repo);
        }

    });

});
