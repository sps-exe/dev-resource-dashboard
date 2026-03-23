/**
 * TRENDING PUBLIC APIs DASHBOARD
 * Core Logic Engine (Vanilla JavaScript)
 * Milestone 2 & 3: Live API integration, HOFs, Debouncing, Local Storage, Dark Mode
 */

// =========================================================================
// 1. APPLICATION STATE
// =========================================================================
let allRepos = [];
// LocalStorage (Bonus feature): Loads saved favorites or creates empty array
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// DOM Elements
const UI = {
    searchBox: document.getElementById('searchInput'),
    languageSelect: document.getElementById('languageFilter'),
    sortSelect: document.getElementById('sortSelect'),
    apiGrid: document.getElementById('api-grid'),
    noResultsMessage: document.getElementById('no-results'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon')
};

// =========================================================================
// 2. INITIALIZATION
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    initTheme(); // Set dark/light mode from local storage
    UI.themeToggle.addEventListener('click', toggleTheme);

    await fetchGitHubData();
    populateLanguageDropdown();

    // Attach Event Listeners
    // Bonus Feature: Debounced Search Input (Improves performance by rejecting useless keypresses)
    UI.searchBox.addEventListener('input', debounce(handleFilterChange, 300));
    
    // Changing dropdowns triggers instant filtering
    UI.languageSelect.addEventListener('change', handleFilterChange);
    UI.sortSelect.addEventListener('change', handleFilterChange);
});

// =========================================================================
// 3. API INTEGRATION (Milestone 2)
// =========================================================================
/**
 * Fetches real-time tech repository data from the public GitHub REST API.
 */
async function fetchGitHubData() {
    try {
        UI.loadingIndicator.classList.remove('hidden');
        
        // milestone 2 requirement: integration of public API (fetch)
        const response = await fetch('https://api.github.com/search/repositories?q=topic:public-api&sort=stars&order=desc&per_page=30');
        
        if (!response.ok) throw new Error("API request failed");
        
        const data = await response.json();
        
        // Milestone 3: Using Array HOF (map) to clean and structure the data
        allRepos = data.items.map(repo => ({
            id: repo.id.toString(),
            name: repo.name,
            description: repo.description || "No description provided.",
            language: repo.language || "Unknown",
            stars: repo.stargazers_count,
            url: repo.html_url
        }));

        renderCards(allRepos);
    } catch (error) {
        console.error("Error fetching data:", error);
        UI.apiGrid.innerHTML = `<p style="color:red; text-align:center;">Failed to load data from GitHub. Please try again later.</p>`;
    } finally {
        UI.loadingIndicator.classList.add('hidden');
    }
}

// =========================================================================
// 4. RENDERING ENGINE
// =========================================================================
/**
 * Maps the array array to HTML templates and injects them. 
 */
function renderCards(repoList) {
    if (repoList.length === 0) {
        UI.apiGrid.classList.add('hidden');
        UI.noResultsMessage.classList.remove('hidden');
        return;
    } 

    UI.apiGrid.classList.remove('hidden');
    UI.noResultsMessage.classList.add('hidden');
    
    // Milestone 3: Array HOF (map) to generate HTML string dynamically avoiding raw loop appends.
    const htmlString = repoList.map(repo => {
        // Find if this specific ID exists in the favorites array
        const isFav = favorites.includes(repo.id);
        
        return `
            <article class="card">
                <div class="card-header">
                    <span class="badge">${repo.language}</span>
                    <span class="badge badge-stars">⭐ ${repo.stars.toLocaleString()}</span>
                </div>
                <h3 class="card-title">${repo.name}</h3>
                <p class="card-description">${repo.description}</p>
                <div class="card-footer">
                    <a href="${repo.url}" target="_blank" class="btn btn-primary">View Repo</a>
                    <!-- Button Interactions (Milestone 3) -->
                    <button class="btn btn-favorite ${isFav ? 'active' : ''}" onclick="toggleFavorite('${repo.id}')">
                        ${isFav ? '❤️ Saved' : '🤍 Save'}
                    </button>
                </div>
            </article>
        `;
    }).join(""); // Join array elements into single HTML string

    UI.apiGrid.innerHTML = htmlString;
}

/**
 * Reads languages directly from data, removing duplicates to form filter options.
 */
function populateLanguageDropdown() {
    // Array HOFs: map() and filter()
    const allLanguages = allRepos.map(repo => repo.language);
    // Remove duplicates using Set, filter out Unknowns, and sort alphabetically
    const uniqueLanguages = [...new Set(allLanguages)].filter(lang => lang !== "Unknown").sort();

    uniqueLanguages.forEach(lang => {
        const option = document.createElement("option");
        option.value = lang;
        option.textContent = lang;
        UI.languageSelect.appendChild(option);
    });
}

// =========================================================================
// 5. SEARCH, FILTER & SORT PIPELINE (Milestone 3)
// =========================================================================
/**
 * A combined HOF pipeline that filters then sorts the data strictly 
 * avoiding any traditional while/for loops.
 */
function handleFilterChange() {
    const searchQuery = UI.searchBox.value.toLowerCase().trim();
    const selectedLang = UI.languageSelect.value;
    const sortOption = UI.sortSelect.value;

    UI.loadingIndicator.classList.remove('hidden');

    // -- Milestone 3: Filtering via Array.filter() --
    let filteredData = allRepos.filter(repo => {
        const matchesLang = (selectedLang === "All" || repo.language === selectedLang);
        
        const nameMatch = repo.name.toLowerCase().includes(searchQuery);
        const descMatch = repo.description.toLowerCase().includes(searchQuery);
        const matchesSearch = nameMatch || descMatch;
        
        return matchesLang && matchesSearch;
    });

    // -- Milestone 3: Sorting via Array.sort() --
    filteredData = filteredData.sort((a, b) => {
        if (sortOption === 'stars-desc') return b.stars - a.stars;
        if (sortOption === 'stars-asc') return a.stars - b.stars;
        if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
        if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
        return 0;
    });

    // Render the newly processed array
    renderCards(filteredData);
    UI.loadingIndicator.classList.add('hidden');
}

// =========================================================================
// 6. BONUS FEATURES & INTERACTIONS
// =========================================================================

/**
 * DEBOUNCING (Bonus Feature)
 * Wraps a function limiting its execution until delay ms pass with no triggers.
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * LOCAL STORAGE: FAVORITES (Bonus & Button Interaction)
 * Mutates the favorites array, saves it to browser Local Storage, and updates UI.
 */
function toggleFavorite(repoId) {
    const isFav = favorites.includes(repoId);
    if (isFav) {
        // Remove from Array
        favorites = favorites.filter(id => id !== repoId);
    } else {
        // Add to Array
        favorites.push(repoId);
    }
    
    // Save stringified array securely
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    // Re-render UI
    handleFilterChange();
}

/**
 * DARK MODE THEME (Milestone 3 & Local Storage)
 * Checks for past preference, toggles class on body, resaves intent.
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light-mode';
    document.body.className = savedTheme;
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-mode');
    const newTheme = isLight ? 'dark-mode' : 'light-mode';
    
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    UI.themeIcon.textContent = theme === 'dark-mode' ? '☀️' : '🌙';
    // Access the text node avoiding wiping out the span innerHTML
    UI.themeToggle.childNodes[2].textContent = theme === 'dark-mode' ? ' Light Mode' : ' Dark Mode';
}
