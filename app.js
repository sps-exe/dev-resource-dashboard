/**
 * DEVELOPER RESOURCE INTELLIGENCE DASHBOARD
 * Core Logic Engine
 * Built with Vanilla JavaScript
 */

// =========================================================================
// 1. APPLICATION STATE
// =========================================================================
// We store the data globally in memory so searching/filtering doesn't 
// require re-fetching from the server.
let allAPIs = []; 

// =========================================================================
// 2. DOM ELEMENTS
// =========================================================================
// Caching our DOM elements prevents the browser from having to search 
// the HTML tree every time a user types a letter.
const domElements = {
    searchBox: document.getElementById('searchInput'),
    categorySelect: document.getElementById('categoryFilter'),
    apiGrid: document.getElementById('api-grid'),
    noResultsMessage: document.getElementById('no-results')
};

// =========================================================================
// 3. INITIALIZATION
// =========================================================================
/**
 * Triggers as soon as the HTML has fully loaded.
 * It coordinates the initial data fetch and setup.
 */
document.addEventListener("DOMContentLoaded", async () => {
    await fetchAPIData();
    populateCategoryDropdown();
    renderCards(allAPIs);
    
    // Attach Event Listeners for Interaction
    domElements.searchBox.addEventListener('input', handleFilterChange);
    domElements.categorySelect.addEventListener('change', handleFilterChange);
});

// =========================================================================
// 4. DATA INGESTION (THE CONTROLLER)
// =========================================================================
/**
 * Fetches the API list. 
 * Using our local apis.json to ensure bulletproof reliability during presentations.
 */
async function fetchAPIData() {
    try {
        const response = await fetch('./apis.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Save the raw data array into our Application State variable
        allAPIs = await response.json();
    } catch (error) {
        console.error("Failed to load API data:", error);
        allAPIs = []; // Fallback to empty array
    }
}

// =========================================================================
// 5. RENDERING ENGINE (THE VIEW)
// =========================================================================
/**
 * Takes an array of API objects and generates HTML cards.
 * @param {Array} apiList - The list of APIs to display
 */
function renderCards(apiList) {
    // 1. Clear the current grid
    domElements.apiGrid.innerHTML = "";

    // 2. If no APIs match the search, show the empty state message
    if (apiList.length === 0) {
        domElements.apiGrid.classList.add('hidden');
        domElements.noResultsMessage.classList.remove('hidden');
        return;
    } 

    // 3. Otherwise, hide the empty state and loop through the data
    domElements.apiGrid.classList.remove('hidden');
    domElements.noResultsMessage.classList.add('hidden');
    
    // Create an HTML string for each API and insert it into the DOM
    let rawHTML = "";
    apiList.forEach(api => {
        
        // Determine what color badge to show for Authentication
        let authBadgeClass = api.authType.toLowerCase() === 'none' ? 'badge-auth-no' : 'badge-auth-yes';
        
        rawHTML += `
            <article class="card">
                <div class="card-header">
                    <span class="badge badge-category">${api.category}</span>
                    <span class="badge ${authBadgeClass}">${api.authType || 'Unknown'}</span>
                </div>
                <h3 class="card-title">${api.name}</h3>
                <p class="card-description">${api.description}</p>
                <div class="card-footer">
                    <a href="${api.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                        View API
                    </a>
                </div>
            </article>
        `;
    });

    // Inject the raw HTML into the grid container
    domElements.apiGrid.innerHTML = rawHTML;
}

/**
 * Dynamically extract unique categories from our dataset to populate the dropdown.
 */
function populateCategoryDropdown() {
    // Extract just the categories
    const allCategories = allAPIs.map(api => api.category);
    
    // Use a Set to remove duplicates, then convert back to a sorted Array
    const uniqueCategories = [...new Set(allCategories)].sort();

    // Generate <option> tags and append to the dropdown
    uniqueCategories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        domElements.categorySelect.appendChild(option);
    });
}

// =========================================================================
// 6. SEARCH & FILTER PIPELINE
// =========================================================================
/**
 * This function handles both text search AND category filtering simultaneously.
 * It creates a filtered copy of the data without mutating the original `allAPIs`.
 */
function handleFilterChange() {
    // 1. Get the current values from the inputs
    const searchQuery = domElements.searchBox.value.toLowerCase().trim();
    const selectedCategory = domElements.categorySelect.value;
    
    // 2. Start a pipeline over the original data
    const filteredAPIs = allAPIs.filter(api => {
        
        // Step A: Category Check
        // If the dropdown says "All", it passes. Otherwise, it must match exactly.
        const matchesCategory = selectedCategory === "All" || api.category === selectedCategory;

        // Step B: Text Search Check
        // Search against both the API name and description
        const nameMatch = api.name.toLowerCase().includes(searchQuery);
        const descMatch = api.description.toLowerCase().includes(searchQuery);
        const matchesSearch = nameMatch || descMatch;

        // Step C: Combine requirements
        // An API card only shows if it passes both the category AND text check
        return matchesCategory && matchesSearch;
    });

    // 3. Send the newly filtered array to the Rendering Engine
    renderCards(filteredAPIs);
}
