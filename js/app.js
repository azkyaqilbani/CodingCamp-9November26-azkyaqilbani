
/* ========================================
   1. Application Configuration
======================================== */

const STORAGE_KEY = "expense_budget_tracker_data";

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Fun"
];

/* ========================================
   2. Central Application State
======================================== */

const state = {
  transactions: [],
  customCategories: [],
  budgets: {},
  selectedMonth: getCurrentMonthKey(),
  sortKey: null,
  storageAvailable: true
};

/* ========================================
   3. Date Utilities
======================================== */

/**
 * Returns the current month in YYYY-MM format.
 */
function getCurrentMonthKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

/**
 * Converts a YYYY-MM month key into a readable month label.
 */
function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);

  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

/* ========================================
   4. Application Initialization
======================================== */

/**
 * Initializes the application.
 */
function initializeApp() {
  const selectedMonthElement = document.getElementById("selected-month");

  if (selectedMonthElement) {
    selectedMonthElement.textContent = formatMonthLabel(
      state.selectedMonth
    );
  }

  console.log("Expense & Budget Tracker initialized.");
}

/* ========================================
   5. Start Application
======================================== */

initializeApp();

// Export configuration and state for future testing.
export {
  STORAGE_KEY,
  DEFAULT_CATEGORIES,
  state,
  getCurrentMonthKey,
  formatMonthLabel,
  initializeApp
};
