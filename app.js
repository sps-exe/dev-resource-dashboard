const STATE = {
    trending: [],
    categories: {},
    favorites: JSON.parse(localStorage.getItem("devpulse_favs")) || [],
    activeTab: "trending",
    activeCategory: "ai",
    searchQuery: "",
    trendingSort: "velocity",
    allSort: "stars-desc",
    allLangFilter: "All"
};

// 1. Data Fetching
async function fetchTrending() {
    document.getElementById("searchLoader").classList.remove("hidden");
    try {
        let response = await fetch("https://api.github.com/search/repositories?q=stars:>50000&sort=stars&order=desc&per_page=30");
        let data = await response.json();
        
        let repos = [];
        for (let i = 0; i < data.items.length; i++) {
            repos.push(makeRepo(data.items[i]));
        }
        STATE.trending = repos;
        
        document.getElementById("hstatTotal").textContent = STATE.trending.length + "+";
        renderTrending();
        populateLangFilter();
    } catch (error) {
        STATE.trending = [];
        renderTrending();
    }
    document.getElementById("searchLoader").classList.add("hidden");
}

async function fetchCategory(category) {
    if (STATE.categories[category]) {
        renderCategoryGrid(STATE.categories[category]);
        return;
    }

    document.getElementById("categoryGrid").innerHTML = "<p>Loading...</p>";
    try {
        let topic = "topic:" + category;
        let response = await fetch("https://api.github.com/search/repositories?q=" + topic + "&sort=stars&order=desc&per_page=18");
        let data = await response.json();
        
        let repos = [];
        for (let i = 0; i < data.items.length; i++) {
            repos.push(makeRepo(data.items[i]));
        }
        STATE.categories[category] = repos;
        renderCategoryGrid(repos);
    } catch (error) {
        document.getElementById("categoryGrid").innerHTML = "<p>Error loading.</p>";
    }
}

function makeRepo(item) {
    let now = new Date();
    let created = new Date(item.created_at);
    let days = Math.floor((now - created) / 86400000);
    if (days < 1) days = 1;

    return {
        id: item.id,
        full_name: item.full_name,
        name: item.name,
        description: item.description || "No description provided.",
        html_url: item.html_url,
        stars: item.stargazers_count,
        forks: item.forks_count,
        language: item.language || "Unknown",
        velocity: Math.round(item.stargazers_count / days),
        pushed_at: item.pushed_at
    };
}

function formatNum(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + "k";
    }
    return String(num || 0);
}

// 2. Rendering
function renderTrending() {
    let repos = sortRepos(STATE.trending, STATE.trendingSort);
    
    // Top 3 Podium
    let top3 = repos.slice(0, 3);
    let podiumHTML = "";
    let medals = ["🥇", "🥈", "🥉"];
    
    for (let i = 0; i < top3.length; i++) {
        let repo = top3[i];
        let isFav = STATE.favorites.includes(repo.full_name);
        podiumHTML += `
            <div class="podium-card rank-${i + 1}" data-action="open-modal" data-repo="${repo.full_name}">
                <span class="podium-rank">${medals[i]}</span>
                <div class="podium-velocity">⚡ ${formatNum(repo.velocity)} stars/day</div>
                <div class="podium-name">${repo.full_name}</div>
                <div class="podium-desc">${repo.description}</div>
                <div class="podium-meta">
                    <span class="podium-stars">★ ${formatNum(repo.stars)}</span>
                    <span class="podium-lang">${repo.language}</span>
                    <div class="podium-actions">
                        <button class="icon-btn copy-btn" data-action="copy-url" data-url="${repo.html_url}">📋</button>
                        <button class="icon-btn fav-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-repo="${repo.full_name}">
                            ${isFav ? '♥' : '♡'}
                        </button>
                        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="btn-view-repo">GitHub ↗</a>
                    </div>
                </div>
            </div>`;
    }
    document.getElementById("podiumGrid").innerHTML = podiumHTML;

    // Remaining list
    let listHTML = "";
    let rest = repos.slice(3);
    for (let i = 0; i < rest.length; i++) {
        let repo = rest[i];
        let isFav = STATE.favorites.includes(repo.full_name);
        listHTML += `
            <div class="trend-row" data-action="open-modal" data-repo="${repo.full_name}">
                <span class="trend-rank">${i + 4}</span>
                <div class="trend-info">
                    <div class="trend-name">${repo.full_name}</div>
                    <div class="trend-desc">${repo.description}</div>
                </div>
                <span class="trend-velocity">⚡ ${formatNum(repo.velocity)}/day</span>
                <span class="trend-stars">★ ${formatNum(repo.stars)}</span>
                <button class="trend-fav-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-repo="${repo.full_name}">
                    ${isFav ? '♥' : '♡'}
                </button>
            </div>`;
    }
    document.getElementById("trendingList").innerHTML = listHTML;
}

function buildCard(repo) {
    let isFav = STATE.favorites.includes(repo.full_name);
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
                    <button class="icon-btn copy-btn" data-action="copy-url" data-url="${repo.html_url}">📋</button>
                    <button class="icon-btn fav-btn ${isFav ? 'active' : ''}" data-action="toggle-fav" data-repo="${repo.full_name}">
                        ${isFav ? '♥' : '♡'}
                    </button>
                    <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="btn-view-repo" data-action="external-link">View ↗</a>
                </div>
            </div>
        </div>`;
}

function renderCategoryGrid(repos) {
    let html = "";
    for (let i = 0; i < repos.length; i++) {
        html += buildCard(repos[i]);
    }
    document.getElementById("categoryGrid").innerHTML = html;
    
    if (repos.length === 0) {
        document.getElementById("catNoResults").classList.remove("hidden");
    } else {
        document.getElementById("catNoResults").classList.add("hidden");
    }
}

function renderAllRepos() {
    let allData = [];
    allData = allData.concat(STATE.trending);
    for (let category in STATE.categories) {
        allData = allData.concat(STATE.categories[category]);
    }

    // Remove duplicates
    let uniqueRepos = [];
    let seenNames = [];
    for (let i = 0; i < allData.length; i++) {
        if (!seenNames.includes(allData[i].full_name)) {
            uniqueRepos.push(allData[i]);
            seenNames.push(allData[i].full_name);
        }
    }

    // Filter by Search Query
    let searchQuery = STATE.searchQuery.toLowerCase();
    if (searchQuery !== "") {
        uniqueRepos = uniqueRepos.filter(function(repo) {
            return repo.name.toLowerCase().includes(searchQuery) || 
                   repo.description.toLowerCase().includes(searchQuery) ||
                   repo.language.toLowerCase().includes(searchQuery);
        });
    }

    // Filter by Language
    if (STATE.allLangFilter !== "All") {
        uniqueRepos = uniqueRepos.filter(function(repo) {
            return repo.language === STATE.allLangFilter;
        });
    }

    // Sort
    uniqueRepos = sortRepos(uniqueRepos, STATE.allSort);

    let html = "";
    for (let i = 0; i < uniqueRepos.length; i++) {
        html += buildCard(uniqueRepos[i]);
    }
    document.getElementById("allRepoGrid").innerHTML = html;

    if (uniqueRepos.length === 0) {
        document.getElementById("allNoResults").classList.remove("hidden");
    } else {
        document.getElementById("allNoResults").classList.add("hidden");
    }
}

function renderFavorites() {
    let allData = [];
    allData = allData.concat(STATE.trending);
    for (let category in STATE.categories) {
        allData = allData.concat(STATE.categories[category]);
    }

    let favRepos = [];
    for (let i = 0; i < allData.length; i++) {
        if (STATE.favorites.includes(allData[i].full_name)) {
            // Find if we already added it
            let alreadyAdded = false;
            for (let j = 0; j < favRepos.length; j++) {
                if (favRepos[j].full_name === allData[i].full_name) {
                    alreadyAdded = true;
                }
            }
            if (!alreadyAdded) {
                favRepos.push(allData[i]);
            }
        }
    }

    let html = "";
    for (let i = 0; i < favRepos.length; i++) {
        html += buildCard(favRepos[i]);
    }
    document.getElementById("favGrid").innerHTML = html;

    if (favRepos.length === 0) {
        document.getElementById("favEmptyState").classList.remove("hidden");
    } else {
        document.getElementById("favEmptyState").classList.add("hidden");
    }
    updateFavCount();
}

// 3. Sorting & Features
function sortRepos(repos, sortType) {
    let sorted = repos.slice(); // Copy array
    sorted.sort(function(a, b) {
        if (sortType === "velocity") {
            return b.velocity - a.velocity;
        } else if (sortType === "stars-desc") {
            return b.stars - a.stars;
        } else if (sortType === "stars-asc") {
            return a.stars - b.stars;
        } else if (sortType === "name-asc") {
            return a.name.localeCompare(b.name);
        } else if (sortType === "name-desc") {
            return b.name.localeCompare(a.name);
        }
        return b.stars - a.stars;
    });
    return sorted;
}

function openModal(fullName) {
    let allData = [];
    allData = allData.concat(STATE.trending);
    for (let category in STATE.categories) {
        allData = allData.concat(STATE.categories[category]);
    }

    let repo = null;
    for (let i = 0; i < allData.length; i++) {
        if (allData[i].full_name === fullName) {
            repo = allData[i];
            break;
        }
    }

    if (!repo) return;

    let isFav = STATE.favorites.includes(repo.full_name);
    let lastPushed = new Date(repo.pushed_at).toLocaleDateString();

    document.getElementById("modalContent").innerHTML = `
        <div class="modal-header-top">
            <span class="repo-card-lang">${repo.language}</span>
            <span class="repo-velocity-badge">⚡ ${formatNum(repo.velocity)} stars/day</span>
        </div>
        <h2 class="modal-title">${repo.full_name}</h2>
        <p class="modal-desc">${repo.description}</p>
        <div class="modal-stats">
            <div class="modal-stat"><span class="modal-stat-val">★ ${formatNum(repo.stars)}</span><span class="modal-stat-label">Stars</span></div>
            <div class="modal-stat"><span class="modal-stat-val">⑂ ${formatNum(repo.forks)}</span><span class="modal-stat-label">Forks</span></div>
            <div class="modal-stat"><span class="modal-stat-val">⚡ ${formatNum(repo.velocity)}</span><span class="modal-stat-label">Stars/Day</span></div>
        </div>
        <p style="text-align:center;font-size:0.8rem;color:gray;margin-bottom:10px;">Last pushed: ${lastPushed}</p>
        <div class="modal-actions">
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="modal-btn-primary">Open on GitHub ↗</a>
            <button class="modal-btn-secondary ${isFav ? 'active' : ''}" data-action="modal-toggle-fav" data-repo="${repo.full_name}">
                ${isFav ? '♥ Saved' : '♡ Save'}
            </button>
            <button class="modal-btn-secondary" data-action="copy-url" data-url="${repo.html_url}">📋 Copy URL</button>
        </div>`;
    
    document.getElementById("repoModal").classList.add("open");
}

function switchTab(tabId) {
    STATE.activeTab = tabId;
    
    let tabs = document.querySelectorAll(".nav-tab");
    for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].dataset.tab === tabId) {
            tabs[i].classList.add("active");
        } else {
            tabs[i].classList.remove("active");
        }
    }

    let contents = document.querySelectorAll(".tab-content");
    for (let i = 0; i < contents.length; i++) {
        if (contents[i].id === "view-" + tabId) {
            contents[i].classList.add("active");
        } else {
            contents[i].classList.remove("active");
        }
    }

    if (tabId === "categories") {
        fetchCategory(STATE.activeCategory);
    } else if (tabId === "all") {
        renderAllRepos();
    } else if (tabId === "favorites") {
        renderFavorites();
    }
    window.scrollTo(0, 0);
}

function toggleFavorite(repoName) {
    let index = STATE.favorites.indexOf(repoName);
    if (index === -1) {
        STATE.favorites.push(repoName);
        showToast("♥ Added to favorites!", "success");
    } else {
        STATE.favorites.splice(index, 1);
        showToast("Removed from favorites", "");
    }
    
    localStorage.setItem("devpulse_favs", JSON.stringify(STATE.favorites));
    updateFavCount();
    
    if (STATE.activeTab === "trending") {
        renderTrending();
    } else if (STATE.activeTab === "categories") {
        renderCategoryGrid(STATE.categories[STATE.activeCategory] || []);
    } else if (STATE.activeTab === "all") {
        renderAllRepos();
    } else if (STATE.activeTab === "favorites") {
        renderFavorites();
    }
}

function showToast(message, type) {
    let toastContainer = document.getElementById("toastContainer");
    let toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(function() {
        toast.remove();
    }, 3000);
}

function updateFavCount() {
    document.getElementById("favBadge").textContent = STATE.favorites.length;
    document.getElementById("hstatFavs").textContent = STATE.favorites.length;
}

function populateLangFilter() {
    let langs = [];
    for (let i = 0; i < STATE.trending.length; i++) {
        let lang = STATE.trending[i].language;
        if (lang && !langs.includes(lang)) {
            langs.push(lang);
        }
    }
    langs.sort();
    
    let html = '<option value="All">All</option>';
    for (let i = 0; i < langs.length; i++) {
        html += '<option value="' + langs[i] + '">' + langs[i] + '</option>';
    }
    document.getElementById("langFilter").innerHTML = html;
}

// 4. Initialization & Event Listeners
document.addEventListener("DOMContentLoaded", function() {
    updateFavCount();
    fetchTrending();

    // Theme logic
    let savedTheme = localStorage.getItem("devpulse_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("themeIcon").textContent = savedTheme === "dark" ? "☽" : "☀";

    document.getElementById("themeToggle").addEventListener("click", function() {
        let currentTheme = document.documentElement.getAttribute("data-theme");
        let nextTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", nextTheme);
        document.getElementById("themeIcon").textContent = nextTheme === "dark" ? "☽" : "☀";
        localStorage.setItem("devpulse_theme", nextTheme);
    });

    // Navigation bindings
    let tabs = document.querySelectorAll(".nav-tab");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener("click", function() {
            switchTab(tabs[i].dataset.tab);
        });
    }

    document.getElementById("logoBtn").addEventListener("click", function(e) {
        e.preventDefault();
        switchTab("trending");
    });
    
    document.getElementById("favNavBtn").addEventListener("click", function() {
        switchTab("favorites");
    });

    document.getElementById("exploreBtn").addEventListener("click", function() {
        switchTab("trending");
    });

    // Search and sorting bindings
    let searchTimer;
    document.getElementById("globalSearch").addEventListener("input", function(e) {
        clearTimeout(searchTimer);
        STATE.searchQuery = e.target.value;
        searchTimer = setTimeout(function() {
            if (STATE.activeTab === "trending" && STATE.searchQuery !== "") {
                switchTab("all");
            } else if (STATE.activeTab === "all") {
                renderAllRepos();
            } else if (STATE.activeTab === "categories") {
                let catData = STATE.categories[STATE.activeCategory] || [];
                let query = STATE.searchQuery.toLowerCase();
                let filtered = catData.filter(function(r) {
                    return r.name.toLowerCase().includes(query) || 
                           r.description.toLowerCase().includes(query);
                });
                renderCategoryGrid(filtered);
            }
        }, 400);
    });

    document.getElementById("trendingSort").addEventListener("change", function(e) {
        let val = e.target.value;
        if (val === "stars") {
            STATE.trendingSort = "stars-desc";
        } else {
            STATE.trendingSort = val;
        }
        renderTrending();
    });

    // Category Buttons
    document.getElementById("categoryChips").addEventListener("click", function(e) {
        let chip = e.target.closest(".chip");
        if (chip) {
            let chips = document.querySelectorAll("#categoryChips .chip");
            for (let i = 0; i < chips.length; i++) {
                chips[i].classList.remove("active");
            }
            chip.classList.add("active");
            STATE.activeCategory = chip.dataset.category;
            fetchCategory(STATE.activeCategory);
        }
    });

    document.getElementById("langFilter").addEventListener("change", function(e) {
        STATE.allLangFilter = e.target.value;
        renderAllRepos();
    });

    document.getElementById("allSort").addEventListener("change", function(e) {
        STATE.allSort = e.target.value;
        renderAllRepos();
    });

    // View mode handlers
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

    document.getElementById("clearFiltersBtn").addEventListener("click", function() {
        document.getElementById("globalSearch").value = "";
        STATE.searchQuery = "";
        document.getElementById("langFilter").value = "All";
        STATE.allLangFilter = "All";
        renderAllRepos();
    });

    document.getElementById("clearFavsBtn").addEventListener("click", function() {
        STATE.favorites = [];
        localStorage.setItem("devpulse_favs", "[]");
        renderFavorites();
        showToast("Favorites cleared", "");
    });

    // Modal close
    document.getElementById("modalClose").addEventListener("click", function() {
        document.getElementById("repoModal").classList.remove("open");
    });
    
    document.getElementById("repoModal").addEventListener("click", function(e) {
        if (e.target.id === "repoModal") {
            document.getElementById("repoModal").classList.remove("open");
        }
    });

    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            document.getElementById("repoModal").classList.remove("open");
        }
    });

    // Event Delegation for document clicks (modals, copy, fav buttons)
    document.addEventListener("click", function(e) {
        let favBtn = e.target.closest("[data-action='toggle-fav']");
        let modalFavBtn = e.target.closest("[data-action='modal-toggle-fav']");
        let copyBtn = e.target.closest("[data-action='copy-url']");
        let card = e.target.closest("[data-action='open-modal']");

        if (favBtn) {
            e.stopPropagation();
            toggleFavorite(favBtn.dataset.repo);
        } else if (modalFavBtn) {
            e.stopPropagation();
            toggleFavorite(modalFavBtn.dataset.repo);
            let isFav = STATE.favorites.includes(modalFavBtn.dataset.repo);
            modalFavBtn.classList.toggle("active", isFav);
            modalFavBtn.innerHTML = isFav ? "♥ Saved" : "♡ Save";
        } else if (copyBtn) {
            e.stopPropagation();
            navigator.clipboard.writeText(copyBtn.dataset.url).then(function() {
                showToast("Copied to clipboard!", "success");
            }).catch(function() {
                showToast("Failed to copy", "error");
            });
        } else if (card) {
            openModal(card.dataset.repo);
        }
    });
});
