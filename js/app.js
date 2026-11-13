
/* ========================================
   1. Application Configuration
======================================== */

const STORAGE_KEY = "expense_budget_tracker_data";

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Fun"
];

const DATA_VERSION = 1;

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

function getCurrentMonthKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);

  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function getMonthKey(dateString) {
  return dateString.slice(0, 7);
}


/* ========================================
   4. Data Validation
======================================== */

/**
 * Checks whether a date is a real YYYY-MM-DD date.
 */
function isValidDate(dateString) {
  if (typeof dateString !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates and cleans custom categories.
 */
function validateCategories(categories) {
  const validCategories = [];
  const existingNames = new Set(
    DEFAULT_CATEGORIES.map(category => category.toLowerCase())
  );

  for (const category of categories) {
    if (typeof category !== "string") continue;

    const cleanName = category.trim();

    if (
      cleanName.length < 1 ||
      cleanName.length > 50
    ) {
      continue;
    }

    const normalizedName = cleanName.toLowerCase();

    if (existingNames.has(normalizedName)) {
      continue;
    }

    existingNames.add(normalizedName);
    validCategories.push(cleanName);
  }

  return validCategories;
}

/**
 * Validates individual transaction records.
 */
function validateTransactions(transactions, categories) {
  const validTransactions = [];
  const existingIds = new Set();

  const availableCategories = new Set(
    categories.map(category => category.toLowerCase())
  );

  for (const transaction of transactions) {
    if (!transaction || typeof transaction !== "object") {
      continue;
    }

    const {
      id,
      item,
      amount,
      category,
      date,
      createdAt
    } = transaction;

    if (
      typeof id !== "string" ||
      id.trim() === "" ||
      existingIds.has(id) ||
      typeof item !== "string" ||
      item.trim() === "" ||
      item.length > 100 ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      typeof category !== "string" ||
      !availableCategories.has(category.toLowerCase()) ||
      !isValidDate(date) ||
      typeof createdAt !== "number" ||
      !Number.isFinite(createdAt) ||
      createdAt < 0
    ) {
      continue;
    }

    existingIds.add(id);

    validTransactions.push({
      id,
      item: item.trim(),
      amount,
      category,
      date,
      createdAt
    });
  }

  return validTransactions;
}

/**
 * Validates monthly budget records.
 */
function validateBudgets(budgets) {
  const validBudgets = {};

  for (const [monthKey, amount] of Object.entries(budgets)) {
    const validMonthKey = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey);

    if (
      validMonthKey &&
      typeof amount === "number" &&
      Number.isFinite(amount) &&
      amount > 0
    ) {
      validBudgets[monthKey] = amount;
    }
  }

  return validBudgets;
}


/* ========================================
   4. Storage Utilities
======================================== */

/**
 * Displays a warning when browser storage is unavailable
 * or saved data cannot be read safely.
 */
function showStorageWarning() {
  if (typeof document === "undefined") return;

  const warning = document.getElementById("storage-warning");

  if (warning) {
    warning.hidden = false;
  }
}

/**
 * Loads saved application data from LocalStorage.
 *
 * Returns true when loading succeeds.
 * Returns false when storage or saved data is unavailable.
 */

function loadData() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (savedData === null) {
      return true;
    }

    const parsedData = JSON.parse(savedData);

    // Validate the overall data structure.
    if (
      !parsedData ||
      typeof parsedData !== "object" ||
      Array.isArray(parsedData) ||
      parsedData.version !== DATA_VERSION ||
      !Array.isArray(parsedData.transactions) ||
      !Array.isArray(parsedData.customCategories) ||
      !parsedData.budgets ||
      typeof parsedData.budgets !== "object" ||
      Array.isArray(parsedData.budgets)
    ) {
      throw new Error("Invalid saved data structure.");
    }

    // Validate individual records.
    const originalCounts = {
      transactions: parsedData.transactions.length,
      categories: parsedData.customCategories.length,
      budgets: Object.keys(parsedData.budgets).length
    };

    state.customCategories = validateCategories(
      parsedData.customCategories
    );

    const allCategories = [
      ...DEFAULT_CATEGORIES,
      ...state.customCategories
    ];

    state.transactions = validateTransactions(
      parsedData.transactions,
      allCategories
    );

    state.budgets = validateBudgets(parsedData.budgets);

    // Report invalid records without discarding valid ones.
    if (
      state.transactions.length !== originalCounts.transactions ||
      state.customCategories.length !== originalCounts.categories ||
      Object.keys(state.budgets).length !== originalCounts.budgets
    ) {
      console.warn(
        "Some invalid saved records were ignored. Valid records were preserved."
      );
    }

    return true;

  } catch (error) {
    console.error("Unable to load saved data:", error);

    state.storageAvailable = false;
    showStorageWarning();

    return false;
  }
}

/**
 * Saves current application data to LocalStorage.
 *
 * Returns true when saving succeeds.
 * Returns false when saving fails.
 */
function saveData() {
  if (!state.storageAvailable) {
    return false;
  }

  try {
    const dataToSave = {
      version: DATA_VERSION,
      transactions: state.transactions,
      customCategories: state.customCategories,
      budgets: state.budgets
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(dataToSave)
    );

    return true;

  } catch (error) {
    console.error("Unable to save data:", error);

    state.storageAvailable = false;
    showStorageWarning();

    return false;
  }
}

/* ========================================
   5. Application Initialization
======================================== */

function initializeApp() {
  loadData();

  const selectedMonthElement =
    document.getElementById("selected-month");

  if (selectedMonthElement) {
    selectedMonthElement.textContent = formatMonthLabel(
      state.selectedMonth
    );
  }

  console.log("Expense & Budget Tracker initialized.");
}

/* ========================================
   6. Start Application
======================================== */

if (typeof document !== "undefined") {
  initializeApp();
}

/* ========================================
   7. Exports for Testing
======================================== */

export {
  STORAGE_KEY,
  DEFAULT_CATEGORIES,
  DATA_VERSION,
  state,
  getCurrentMonthKey,
  formatMonthLabel,
  loadData,
  saveData,
  initializeApp,
  isValidDate,
  validateCategories,
  validateTransactions,
  validateBudgets,
  formatCurrency,
  formatDate,
  getMonthKey,
};
