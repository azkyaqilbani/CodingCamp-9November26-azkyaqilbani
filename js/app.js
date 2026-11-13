/**
 * Expense & Budget Visualizer
 * Single-file Vanilla JS application (Req 10.1, 10.3)
 *
 * Module scaffold — class stubs for all nine components.
 * Full implementations are added in subsequent tasks.
 */

'use strict';

// ---------------------------------------------------------------------------
// LocalStorageAdapter
// Responsibility: Encapsulate Local Storage access with error handling.
// (Req 9.1, 9.2, 9.3, 9.4)
// ---------------------------------------------------------------------------
class LocalStorageAdapter {
  /**
   * Returns true if Local Storage is accessible.
   * Catches SecurityError thrown in restricted contexts (e.g. private browsing
   * with storage blocked, cross-origin iframes).
   * @returns {boolean}
   */
  static isAvailable() {
    try {
      const testKey = '__lsa_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Serialises data as JSON and writes to the given key.
   * Returns false on SecurityError (unavailable) or QuotaExceededError (storage full).
   * @param {string} key
   * @param {any} data
   * @returns {boolean} true on success, false on failure
   */
  static save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      // SecurityError: storage is blocked/unavailable
      // QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED: storage is full
      return false;
    }
  }

  /**
   * Reads and deserialises JSON data from the given key.
   * Returns null when the key is absent, storage is unavailable (SecurityError),
   * or the stored value is not valid JSON (SyntaxError).
   * @param {string} key
   * @returns {any|null} parsed value, or null on failure
   */
  static load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      // SecurityError: storage unavailable
      // SyntaxError: corrupt / non-JSON value stored
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Validator
// Responsibility: Input validation and error message generation.
// (Req 1.4, 1.5, 6.3)
// ---------------------------------------------------------------------------
class Validator {
  /**
   * Validates transaction form fields.
   * @param {string} item
   * @param {string} amount
   * @param {string} category
   * @returns {{ isValid: boolean, errors: Map<string, string> }}
   */
  static validateTransactionForm(item, amount, category) {
    const errors = new Map();

    // Validate item name (Req 1.4)
    const trimmedItem = typeof item === 'string' ? item.trim() : '';
    if (trimmedItem.length === 0) {
      errors.set('item', 'Item name is required.');
    } else if (trimmedItem.length > 100) {
      errors.set('item', 'Item name must be 100 characters or fewer.');
    }

    // Validate amount (Req 1.5)
    const parsed = parseFloat(amount);
    if (!isFinite(parsed)) {
      errors.set('amount', 'Please enter a valid amount between 0.01 and 999,999,999.99.');
    } else {
      // Check range
      if (parsed < 0.01 || parsed > 999999999.99) {
        errors.set('amount', 'Please enter a valid amount between 0.01 and 999,999,999.99.');
      } else {
        // Check decimal places: multiply by 100 and verify it rounds to itself
        const cents = Math.round(parsed * 100);
        if (Math.abs(cents / 100 - parsed) > 1e-9) {
          errors.set('amount', 'Please enter a valid amount between 0.01 and 999,999,999.99.');
        }
      }
    }

    // Validate category (Req 1.4)
    const trimmedCategory = typeof category === 'string' ? category.trim() : '';
    if (trimmedCategory.length === 0) {
      errors.set('category', 'Please select a category.');
    }

    return { isValid: errors.size === 0, errors };
  }

  /**
   * Validates a custom category name.
   * @param {string} name
   * @param {string[]} existingCategories
   * @returns {{ isValid: boolean, errors: Map<string, string> }}
   */
  static validateCustomCategory(name, existingCategories) {
    const errors = new Map();
    const trimmed = typeof name === 'string' ? name.trim() : '';

    // Check empty / whitespace-only (Req 6.3)
    if (trimmed.length === 0) {
      errors.set('category', 'Category name cannot be empty.');
      return { isValid: false, errors };
    }

    // Check max length (Req 6.1)
    if (trimmed.length > 50) {
      errors.set('category', 'Category name must be 50 characters or fewer.');
      return { isValid: false, errors };
    }

    // Check case-insensitive duplicate against existing categories (Req 6.3)
    const trimmedLower = trimmed.toLowerCase();
    const existing = Array.isArray(existingCategories) ? existingCategories : [];
    const isDuplicate = existing.some(c => typeof c === 'string' && c.toLowerCase() === trimmedLower);
    if (isDuplicate) {
      errors.set('category', 'This category already exists.');
      return { isValid: false, errors };
    }

    return { isValid: true, errors };
  }

  /**
   * Parses an amount string to a rounded float, or null if invalid.
   * @param {string|number} amount
   * @returns {number|null}
   */
  static formatAmount(amount) {
    const parsed = parseFloat(amount);
    if (!isFinite(parsed)) return null;
    const rounded = Math.round(parsed * 100) / 100;
    if (rounded < 0.01 || rounded > 999999999.99) return null;
    return rounded;
  }

  /**
   * Trims and truncates text to maxLength.
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  static sanitizeText(text, maxLength) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  }
}

// ---------------------------------------------------------------------------
// StateManager
// Responsibility: Central store for all transactions and categories with
// persistence and reactive subscriptions.
// (Req 1.3, 2.4, 3.2, 4.1, 5.1, 6.2, 7.1, 8.2, 9.1)
// ---------------------------------------------------------------------------
class StateManager {
  /**
   * @param {typeof LocalStorageAdapter} storage
   */
  constructor(storage) {
    // TODO: implement in Task 2.3 / 2.6 / 2.10
    this._storage = storage;
    /** @type {Array<object>} */
    this._transactions = [];
    /** @type {string[]} */
    this._customCategories = [];
    /** @type {Function[]} */
    this._listeners = [];
    /** @type {boolean} */
    this.storageError = false;
  }

  // -- Private helpers ------------------------------------------------------

  /**
   * Fires every registered listener.
   * @private
   */
  _notify() {
    for (const listener of this._listeners) {
      listener();
    }
  }

  // -- Transaction operations (Task 2.3) ------------------------------------

  /**
   * @param {string} item
   * @param {number} amount
   * @param {string} category
   * @returns {object|null}
   */
  addTransaction(item, amount, category) {
    // Build a unique id: Unix-ms timestamp + underscore + 6-char alphanumeric suffix
    const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    const id = `${Date.now()}_${suffix}`;
    const timestamp = Date.now();

    const transaction = { id, item, amount, category, timestamp };
    this._transactions.push(transaction);

    if (!this.save()) {
      // Persist failed — roll back and return null
      this._transactions.pop();
      return null;
    }

    this._notify();
    return transaction;
  }

  /**
   * @param {string} transactionId
   * @returns {boolean}
   */
  deleteTransaction(transactionId) {
    const index = this._transactions.findIndex(t => t.id === transactionId);
    if (index === -1) return false;

    // Remove the transaction optimistically
    const [removed] = this._transactions.splice(index, 1);

    if (!this.save()) {
      // Persist failed — restore the transaction at its original position
      this._transactions.splice(index, 0, removed);
      return false;
    }

    this._notify();
    return true;
  }

  /**
   * Returns a sorted copy of the transaction list.
   * @param {string|null} sortKey  null | 'amount' | 'category'
   * @returns {object[]}
   */
  getTransactions(sortKey = null) {
    const copy = [...this._transactions];

    if (sortKey === 'amount') {
      // Descending by amount; tiebreaker: descending by timestamp
      copy.sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return b.timestamp - a.timestamp;
      });
    } else if (sortKey === 'category') {
      // Ascending alphabetically (case-insensitive); tiebreaker: descending by timestamp
      copy.sort((a, b) => {
        const catA = a.category.toLowerCase();
        const catB = b.category.toLowerCase();
        if (catA !== catB) return catA < catB ? -1 : 1;
        return b.timestamp - a.timestamp;
      });
    } else {
      // Default: descending by timestamp (newest first)
      copy.sort((a, b) => b.timestamp - a.timestamp);
    }

    return copy;
  }

  // -- Category operations and derived data (Task 2.6) ---------------------

  /**
   * Adds a custom category if the name (trimmed) is non-empty and does not
   * already exist among the full category list (case-insensitive).
   * Persists the updated custom-category list and notifies subscribers.
   * @param {string} name
   * @returns {boolean} true on success, false when duplicate or persist fails
   */
  addCustomCategory(name) {
    const trimmed = (name || '').trim();
    if (trimmed.length === 0) return false;

    // Case-insensitive uniqueness check against defaults + existing custom categories
    const allLower = this.getCategories().map(c => c.toLowerCase());
    if (allLower.includes(trimmed.toLowerCase())) return false;

    this._customCategories.push(trimmed);

    const persisted = this._storage.save(
      'expense_tracker_categories',
      this._customCategories
    );

    if (!persisted) {
      // Roll back
      this._customCategories.pop();
      return false;
    }

    this._notify();
    return true;
  }

  /**
   * Returns the merged list of default categories and any custom categories.
   * @returns {string[]}
   */
  getCategories() {
    return ['Food', 'Transport', 'Fun', ...this._customCategories];
  }

  /**
   * Returns the sum of all transaction amounts rounded to 2 decimal places.
   * @returns {number}
   */
  getBalance() {
    const raw = this._transactions.reduce((sum, t) => sum + t.amount, 0);
    return Math.round(raw * 100) / 100;
  }

  /**
   * Returns a Map from category name → total amount for every category that
   * has at least one transaction. Categories with a 0 total are excluded.
   * @returns {Map<string, number>}
   */
  getCategoryTotals() {
    const totals = new Map();

    for (const t of this._transactions) {
      const prev = totals.get(t.category) || 0;
      totals.set(t.category, Math.round((prev + t.amount) * 100) / 100);
    }

    // Remove any entries that ended up at exactly 0 (should not happen with
    // positive amounts, but guard defensively)
    for (const [cat, total] of totals) {
      if (total <= 0) totals.delete(cat);
    }

    return totals;
  }

  /**
   * Groups transactions by YYYY-MM, computes per-category totals and a
   * grand total for each month, then returns the groups sorted descending
   * (most recent month first).
   * @returns {Map<string, { month: string, categoryTotals: Map<string, number>, grandTotal: number }>}
   */
  getMonthlySummary() {
    /** @type {Map<string, { month: string, categoryTotals: Map<string, number>, grandTotal: number }>} */
    const summary = new Map();

    for (const t of this._transactions) {
      const date = new Date(t.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      if (!summary.has(key)) {
        summary.set(key, { month: key, categoryTotals: new Map(), grandTotal: 0 });
      }

      const group = summary.get(key);
      const prevCat = group.categoryTotals.get(t.category) || 0;
      group.categoryTotals.set(
        t.category,
        Math.round((prevCat + t.amount) * 100) / 100
      );
      group.grandTotal = Math.round((group.grandTotal + t.amount) * 100) / 100;
    }

    // Sort descending by YYYY-MM key (lexicographic order works for ISO-style strings)
    const sorted = new Map(
      [...summary.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    );

    return sorted;
  }

  // -- Observers and persistence (Task 2.10) --------------------------------

  /**
   * Registers a listener callback fired after every state mutation.
   * Returns an unsubscribe function that removes the listener.
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) {
        this._listeners.splice(idx, 1);
      }
    };
  }

  /**
   * Reads both Local Storage keys, validates each transaction against the
   * Transaction schema (discards invalid entries), and merges custom
   * categories with the defaults.
   *
   * Sets `this.storageError = true` and initialises to empty state when
   * the adapter returns null for the transactions key (unavailable /
   * quota exceeded / corrupt JSON).
   *
   * Requirements: 2.4, 2.6, 4.4, 6.4, 9.3, 9.4
   */
  load() {
    // --- Load transactions ------------------------------------------------
    const rawTransactions = this._storage.load('expense_tracker_transactions');

    if (rawTransactions === null) {
      // Storage unavailable, quota exceeded, or corrupt data
      this.storageError = true;
      this._transactions = [];
      this._customCategories = [];
      return;
    }

    // Validate each transaction against the schema; silently discard invalid ones
    if (Array.isArray(rawTransactions)) {
      this._transactions = rawTransactions.filter(t => this._isValidTransaction(t));
    } else {
      // Stored value is not an array — treat as corrupt
      this.storageError = true;
      this._transactions = [];
    }

    // --- Load custom categories -------------------------------------------
    const rawCategories = this._storage.load('expense_tracker_categories');

    if (rawCategories === null) {
      // Missing key or unreadable — start with empty custom list (not fatal)
      this._customCategories = [];
    } else if (Array.isArray(rawCategories)) {
      // Accept only non-empty strings; silently discard anything else
      this._customCategories = rawCategories.filter(
        c => typeof c === 'string' && c.trim().length > 0
      );
    } else {
      this._customCategories = [];
    }
  }

  /**
   * Validates a transaction object against the Transaction schema.
   * - id: non-empty string
   * - item: string with 1–100 chars (after trim)
   * - amount: finite number within 0.01–999,999,999.99
   * - category: non-empty string
   * - timestamp: positive integer
   * @private
   * @param {any} t
   * @returns {boolean}
   */
  _isValidTransaction(t) {
    if (t === null || typeof t !== 'object') return false;

    // id: non-empty string
    if (typeof t.id !== 'string' || t.id.trim().length === 0) return false;

    // item: string, 1–100 chars
    if (typeof t.item !== 'string') return false;
    const trimmedItem = t.item.trim();
    if (trimmedItem.length < 1 || trimmedItem.length > 100) return false;

    // amount: finite number, 0.01–999,999,999.99
    if (typeof t.amount !== 'number' || !isFinite(t.amount)) return false;
    if (t.amount < 0.01 || t.amount > 999_999_999.99) return false;

    // category: non-empty string
    if (typeof t.category !== 'string' || t.category.trim().length === 0) return false;

    // timestamp: positive integer
    if (typeof t.timestamp !== 'number') return false;
    if (!Number.isInteger(t.timestamp) || t.timestamp <= 0) return false;

    return true;
  }

  /**
   * Persists the current transaction list to Local Storage.
   * Full implementation added in Task 2.10; this minimal version
   * is sufficient for transaction operations to work end-to-end.
   * @returns {boolean}
   */
  save() {
    return this._storage.save('expense_tracker_transactions', this._transactions);
  }
}

// ---------------------------------------------------------------------------
// TransactionForm
// Responsibility: Render form, handle submission, display validation errors.
// (Req 1.1, 1.2, 1.3, 1.4, 1.5, 1.6)
// ---------------------------------------------------------------------------
class TransactionForm {
  /**
   * @param {StateManager} stateManager
   * @param {string[]} categories
   */
  constructor(stateManager, categories) {
    // TODO: implement in Task 5.1 / 5.2
    this._stateManager = stateManager;
    this._categories = categories;
    this._formElement = null;
  }

  /**
   * @param {HTMLElement} containerElement
   */
  render(containerElement) {
    // TODO: implement in Task 5.1
  }

  /**
   * @param {{ isValid: boolean, errors: Map<string, string> }} validationResult
   */
  showErrors(validationResult) {
    // TODO: implement in Task 5.1
  }

  clearErrors() {
    // TODO: implement in Task 5.1
  }

  reset() {
    // TODO: implement in Task 5.2
  }

  /**
   * @param {string[]} categories
   */
  updateCategories(categories) {
    // TODO: implement in Task 5.2
  }
}

// ---------------------------------------------------------------------------
// TransactionList
// Responsibility: Render scrollable list with delete controls and sorting.
// (Req 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 8.1–8.5)
// ---------------------------------------------------------------------------
class TransactionList {
  /**
   * @param {StateManager} stateManager
   */
  constructor(stateManager) {
    // TODO: implement in Task 7.1 / 7.4 / 7.5
    this._stateManager = stateManager;
    /** @type {string|null} */
    this._sortKey = null;
    this._containerElement = null;
  }

  /**
   * @param {HTMLElement} containerElement
   * @param {object[]} transactions
   */
  render(containerElement, transactions) {
    // TODO: implement in Task 7.1
  }

  /**
   * @param {string|null} sortKey  'amount' | 'category' | null
   */
  setSortKey(sortKey) {
    // TODO: implement in Task 7.5
  }

  /**
   * @returns {string|null}
   */
  getSortKey() {
    // TODO: implement in Task 7.5
    return this._sortKey;
  }

  /**
   * @param {HTMLElement} containerElement
   */
  renderEmptyState(containerElement) {
    // TODO: implement in Task 7.4
  }
}

// ---------------------------------------------------------------------------
// BalanceDisplay
// Responsibility: Calculate and display total balance.
// (Req 4.1, 4.2, 4.3, 4.4)
// ---------------------------------------------------------------------------
class BalanceDisplay {
  /**
   * @param {StateManager} stateManager
   */
  constructor(stateManager) {
    // TODO: implement in Task 6.1
    this._stateManager = stateManager;
    this._containerElement = null;
  }

  /**
   * @param {HTMLElement} containerElement
   * @param {number} balance
   */
  render(containerElement, balance) {
    // TODO: implement in Task 6.1
  }
}

// ---------------------------------------------------------------------------
// ChartRenderer
// Responsibility: Render and update Chart.js pie chart.
// (Req 5.1, 5.2, 5.3, 5.4, 5.6)
// ---------------------------------------------------------------------------
class ChartRenderer {
  /**
   * @param {StateManager} stateManager
   * @param {any} chartJsInstance  window.Chart
   */
  constructor(stateManager, chartJsInstance) {
    // TODO: implement in Task 9.1 / 9.2
    this._stateManager = stateManager;
    this._Chart = chartJsInstance;
    /** @type {any|null} */
    this._chartInstance = null;
    this._containerElement = null;
  }

  /**
   * @param {HTMLCanvasElement} canvasElement
   * @param {Map<string, number>} categoryTotals
   */
  render(canvasElement, categoryTotals) {
    // TODO: implement in Task 9.1
  }

  /**
   * @param {Map<string, number>} categoryTotals
   */
  update(categoryTotals) {
    // TODO: implement in Task 9.1
  }

  /**
   * @param {HTMLElement} containerElement
   */
  renderPlaceholder(containerElement) {
    // TODO: implement in Task 9.2
  }
}

// ---------------------------------------------------------------------------
// CategoryManager
// Responsibility: UI for adding custom categories.
// (Req 6.1, 6.2, 6.3)
// ---------------------------------------------------------------------------
class CategoryManager {
  /**
   * @param {StateManager} stateManager
   */
  constructor(stateManager) {
    // TODO: implement in Task 10.1
    this._stateManager = stateManager;
    this._containerElement = null;
    this._inputElement = null;
  }

  /**
   * @param {HTMLElement} containerElement
   * @param {string[]} existingCategories
   */
  render(containerElement, existingCategories) {
    // TODO: implement in Task 10.1
  }

  /**
   * @param {string} message
   */
  showError(message) {
    // TODO: implement in Task 10.1
  }

  clearError() {
    // TODO: implement in Task 10.1
  }
}

// ---------------------------------------------------------------------------
// MonthlySummary
// Responsibility: Group transactions by month and display totals.
// (Req 7.1–7.6)
// ---------------------------------------------------------------------------
class MonthlySummary {
  /**
   * @param {StateManager} stateManager
   */
  constructor(stateManager) {
    // TODO: implement in Task 11.1
    this._stateManager = stateManager;
    this._containerElement = null;
  }

  /**
   * @param {HTMLElement} containerElement
   * @param {Map<string, { month: string, categoryTotals: Map<string, number>, grandTotal: number }>} summaryData
   */
  render(containerElement, summaryData) {
    // TODO: implement in Task 11.1
  }
}

// ---------------------------------------------------------------------------
// App
// Responsibility: Initialization and component wiring (sole entry point).
// (Req 2.4, 2.6, 4.4, 4.5, 6.4, 9.3, 9.4)
// ---------------------------------------------------------------------------
class App {
  constructor() {
    // TODO: implement in Task 12.1
    this._stateManager = null;
    this._transactionForm = null;
    this._transactionList = null;
    this._balanceDisplay = null;
    this._chartRenderer = null;
    this._categoryManager = null;
    this._monthlySummary = null;
  }

  /**
   * Bootstrap the application: load state, render all components, wire subscriptions.
   */
  init() {
    // TODO: implement in Task 12.1
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});

// ---------------------------------------------------------------------------
// ESM exports — for Node/Vitest testing
// ---------------------------------------------------------------------------
export { StateManager, LocalStorageAdapter, Validator };

