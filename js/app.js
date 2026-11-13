
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

function getAdjacentMonthKey(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);

  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");

  return `${newYear}-${newMonth}`;
}

function changeSelectedMonth(offset) {
  state.selectedMonth = getAdjacentMonthKey(
    state.selectedMonth,
    offset
  );

  renderMonthlyView();
}

function goToCurrentMonth() {
  state.selectedMonth = getCurrentMonthKey();

  renderMonthlyView();
}

function renderMonthlyView() {
  const selectedMonthElement =
    document.getElementById("selected-month");

  if (selectedMonthElement) {
    selectedMonthElement.textContent = formatMonthLabel(
      state.selectedMonth
    );
  }

  renderTransactionHistory();
  renderMonthlyOverview();
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


function getAllCategories() {
  return [...DEFAULT_CATEGORIES, ...state.customCategories];
}

function showTransactionError(message) {
  const errorElement = document.getElementById("transaction-error");

  if (errorElement) {
    errorElement.textContent = message;
  }
}

function createTransaction({ item, amount, category, date }) {
  const cleanItem = item.trim();
  const numericAmount = Number(amount);
  const availableCategories = getAllCategories();

  if (!cleanItem || cleanItem.length > 100) {
    return { success: false, message: "Please enter an item name (maximum 100 characters)." };
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { success: false, message: "Please enter a valid amount greater than zero." };
  }

  if (!availableCategories.includes(category)) {
    return { success: false, message: "Please select a valid category." };
  }

  if (!isValidDate(date)) {
    return { success: false, message: "Please enter a valid transaction date." };
  }

  const transaction = {
    id: crypto.randomUUID(),
    item: cleanItem,
    amount: numericAmount,
    category,
    date,
    createdAt: Date.now()
  };

  state.transactions.push(transaction);

  const saved = saveData();

  return {
    success: true,
    transaction,
    saved
  };
}

function handleTransactionSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const result = createTransaction({
    item: formData.get("item") || "",
    amount: formData.get("amount"),
    category: formData.get("category") || "",
    date: formData.get("date") || ""
  });

  if (!result.success) {
    showTransactionError(result.message);
    return;
  }

  form.reset();
  setDefaultTransactionDate();
  showTransactionError("");
  renderMonthlyView();

  if (!result.saved) {
    showTransactionError(
      "Expense added for this session, but could not be saved permanently."
    );
  }
}

function setDefaultTransactionDate() {
  const dateInput = document.getElementById("transaction-date");

  if (dateInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    dateInput.value = `${year}-${month}-${day}`;
  }
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

  const previousMonthButton =
    document.getElementById("prev-month");

  if (previousMonthButton) {
    previousMonthButton.addEventListener("click", () => {
      changeSelectedMonth(-1);
    });
  }

  const nextMonthButton =
    document.getElementById("next-month");

  if (nextMonthButton) {
    nextMonthButton.addEventListener("click", () => {
      changeSelectedMonth(1);
    });
  }

  const currentMonthButton =
    document.getElementById("current-month");

  if (currentMonthButton) {
    currentMonthButton.addEventListener(
      "click",
      goToCurrentMonth
    );
  }

  const selectedMonthElement =
    document.getElementById("selected-month");

  if (selectedMonthElement) {
    selectedMonthElement.textContent = formatMonthLabel(
      state.selectedMonth
    );
  }

  const transactionForm =
    document.getElementById("transaction-form");

  if (transactionForm) {
    transactionForm.addEventListener(
      "submit",
      handleTransactionSubmit
    );
  }

  setDefaultTransactionDate();

  const transactionList =
    document.getElementById("transaction-list");

  if (transactionList) {
    transactionList.addEventListener(
      "click",
      handleHistoryClick
    );
  }

  const sortSelect =
    document.getElementById("sort-transactions");

  if (sortSelect) {
    sortSelect.addEventListener(
      "change",
      handleSortChange
    );
  }

  renderMonthlyView();

  console.log("Expense & Budget Tracker initialized.");
}
  
function getMonthlyTransactions() {
  return state.transactions.filter(
    transaction => getMonthKey(transaction.date) === state.selectedMonth
  );
}

function calculateMonthlyExpenses() {
  return getMonthlyTransactions().reduce(
    (total, transaction) => total + transaction.amount,
    0
  );
}

function renderMonthlyOverview() {
  const monthlyExpensesElement =
    document.getElementById("monthly-expenses");

  if (!monthlyExpensesElement) return;

  monthlyExpensesElement.textContent =
    formatCurrency(calculateMonthlyExpenses());
}

function sortTransactions(transactions) {
  const sorted = [...transactions];
  const sortKey = state.sortKey || "newest";

  sorted.sort((a, b) => {
    if (sortKey === "amount") {
      return (
        b.amount - a.amount ||
        b.date.localeCompare(a.date) ||
        b.createdAt - a.createdAt
      );
    }

    if (sortKey === "category") {
      return (
        a.category.localeCompare(b.category) ||
        b.date.localeCompare(a.date) ||
        b.createdAt - a.createdAt
      );
    }

    return (
      b.createdAt - a.createdAt ||
      b.date.localeCompare(a.date)
    );
  });

  return sorted;
}

function renderTransactionHistory() {
  const transactionList = document.getElementById("transaction-list");
  const emptyState = document.getElementById("history-empty-state");

  if (!transactionList || !emptyState) return;

  const transactions = sortTransactions(getMonthlyTransactions());

  transactionList.replaceChildren();
  emptyState.hidden = transactions.length > 0;

  transactions.forEach(transaction => {
    const listItem = document.createElement("li");
    listItem.className = "transaction-item";

    const details = document.createElement("span");
    details.className = "transaction-details";
    details.textContent =
      `${transaction.item} · ${transaction.category} · ${formatDate(transaction.date)}`;

    const amount = document.createElement("span");
    amount.className = "transaction-amount";
    amount.textContent = formatCurrency(transaction.amount);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-transaction";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute(
      "aria-label",
      `Delete ${transaction.item}`
    );
    deleteButton.dataset.transactionId = transaction.id;

    listItem.append(details, amount, deleteButton);
    transactionList.appendChild(listItem);
  });
}

function deleteTransaction(transactionId) {
  const originalLength = state.transactions.length;

  state.transactions = state.transactions.filter(
    transaction => transaction.id !== transactionId
  );

  if (state.transactions.length === originalLength) {
    return { success: false, saved: false };
  }

  const saved = saveData();

  return { success: true, saved };
}

function handleHistoryClick(event) {
  const deleteButton = event.target.closest("[data-transaction-id]");

  if (!deleteButton) return;

  const transactionId = deleteButton.dataset.transactionId;
  const result = deleteTransaction(transactionId);

  if (result.success) {
    renderMonthlyView();
  }
}

function handleSortChange(event) {
  state.sortKey = event.target.value;
  renderTransactionHistory();
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
  getAllCategories,
  createTransaction,
  handleTransactionSubmit,
  setDefaultTransactionDate,
  getMonthlyTransactions,
  sortTransactions,
  renderTransactionHistory,
  deleteTransaction,
  handleHistoryClick,
  handleSortChange,
  calculateMonthlyExpenses,
  renderMonthlyOverview,
  changeSelectedMonth,
  goToCurrentMonth,
  renderMonthlyView,
  getAdjacentMonthKey,
};
