
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import {
  STORAGE_KEY,
  DEFAULT_CATEGORIES,
  DATA_VERSION,
  state,
  getCurrentMonthKey,
  formatMonthLabel,
  formatCurrency,
  formatDate,
  getMonthKey,
  isValidDate,
  validateCategories,
  validateTransactions,
  validateBudgets,
  loadData,
  saveData,
  getAllCategories,
  createTransaction,
  getMonthlyTransactions,
  sortTransactions,
  deleteTransaction,
} from "./app.js";

const validTransaction = {
  id: "tx-001",
  item: "Lunch",
  amount: 25000,
  category: "Food",
  date: "2026-11-13",
  createdAt: 1794550000000
};

function makeStorage(initialData = null) {
  let storedValue = initialData;

  return {
    getItem: vi.fn(() => storedValue),
    setItem: vi.fn((key, value) => {
      storedValue = value;
    }),
    getStoredValue: () => storedValue
  };
}

beforeEach(() => {
  state.transactions = [];
  state.customCategories = [];
  state.budgets = {};
  state.selectedMonth = getCurrentMonthKey();
  state.sortKey = null;
  state.storageAvailable = true;

  globalThis.localStorage = makeStorage();
});

afterEach(() => {
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

describe("Date utilities", () => {
  test("getCurrentMonthKey returns YYYY-MM format", () => {
    expect(getCurrentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });

  test("formatMonthLabel formats a month and year", () => {
    expect(formatMonthLabel("2026-11")).toBe("November 2026");
  });

  test("formatDate formats a transaction date", () => {
    expect(formatDate("2026-11-13")).toBe("13 Nov 2026");
  });

  test("getMonthKey extracts the month from a date", () => {
    expect(getMonthKey("2026-11-13")).toBe("2026-11");
  });

  test("isValidDate accepts valid dates", () => {
    expect(isValidDate("2026-11-13")).toBe(true);
  });

  test("isValidDate rejects invalid dates", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("13-11-2026")).toBe(false);
    expect(isValidDate("invalid")).toBe(false);
  });
});

describe("Currency formatting", () => {
  test("formatCurrency formats amounts as Indonesian Rupiah", () => {
    const result = formatCurrency(25000);

    expect(result).toContain("25.000");
    expect(result).toContain("00");
    expect(result).toContain("Rp");
  });
});

describe("Data validation", () => {
  test("validateCategories removes invalid and duplicate categories", () => {
    expect(
      validateCategories([
        "Shopping",
        "shopping",
        "Food",
        "",
        "  ",
        "Entertainment"
      ])
    ).toEqual(["Shopping", "Entertainment"]);
  });

  test("validateTransactions preserves valid transactions", () => {
    expect(
      validateTransactions(
        [validTransaction],
        DEFAULT_CATEGORIES
      )
    ).toEqual([validTransaction]);
  });

  test("validateTransactions rejects invalid transactions", () => {
    const invalidTransactions = [
      { ...validTransaction, amount: -100 },
      { ...validTransaction, item: "" },
      { ...validTransaction, date: "2026-02-30" },
      { ...validTransaction, id: "" },
      { ...validTransaction, category: "Unknown" }
    ];

    expect(
      validateTransactions(
        invalidTransactions,
        DEFAULT_CATEGORIES
      )
    ).toEqual([]);
  });

  test("validateBudgets keeps only valid monthly budgets", () => {
    expect(
      validateBudgets({
        "2026-11": 2000000,
        "2026-12": 2500000,
        "2026-13": 1000000,
        "2026-10": -500
      })
    ).toEqual({
      "2026-11": 2000000,
      "2026-12": 2500000
    });
  });
});

describe("LocalStorage", () => {
  test("loadData returns true when no saved data exists", () => {
    expect(loadData()).toBe(true);
    expect(state.transactions).toEqual([]);
  });

  test("loadData restores valid saved data", () => {
    const savedData = {
      version: DATA_VERSION,
      transactions: [validTransaction],
      customCategories: ["Shopping"],
      budgets: { "2026-11": 2000000 }
    };

    globalThis.localStorage = makeStorage(JSON.stringify(savedData));

    expect(loadData()).toBe(true);
    expect(state.transactions).toEqual([validTransaction]);
    expect(state.customCategories).toEqual(["Shopping"]);
    expect(state.budgets).toEqual({ "2026-11": 2000000 });
  });

  test("loadData ignores invalid individual records", () => {
    const savedData = {
      version: DATA_VERSION,
      transactions: [
        validTransaction,
        { ...validTransaction, id: "invalid", amount: -10 }
      ],
      customCategories: ["Shopping", "Food", "shopping"],
      budgets: {
        "2026-11": 2000000,
        "2026-13": 1000000
      }
    };

    globalThis.localStorage = makeStorage(JSON.stringify(savedData));

    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(loadData()).toBe(true);
    expect(state.transactions).toHaveLength(1);
    expect(state.customCategories).toEqual(["Shopping"]);
    expect(state.budgets).toEqual({ "2026-11": 2000000 });
  });

  test("saveData stores the current application data", () => {
    state.transactions = [validTransaction];
    state.customCategories = ["Shopping"];
    state.budgets = { "2026-11": 2000000 };

    expect(saveData()).toBe(true);

    const saved = JSON.parse(
      globalThis.localStorage.getStoredValue()
    );

    expect(saved.version).toBe(DATA_VERSION);
    expect(saved.transactions).toEqual([validTransaction]);
    expect(saved.customCategories).toEqual(["Shopping"]);
    expect(saved.budgets).toEqual({ "2026-11": 2000000 });
  });

  test("saveData does not save when storage is unavailable", () => {
    state.storageAvailable = false;

    expect(saveData()).toBe(false);
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled();
  });
});


describe("Transaction creation", () => {
  test("creates and saves a valid transaction", () => {
    const result = createTransaction({
      item: "  Lunch at cafe  ",
      amount: "25000",
      category: "Food",
      date: "2026-11-13"
    });

    expect(result.success).toBe(true);
    expect(result.saved).toBe(true);
    expect(result.transaction.item).toBe("Lunch at cafe");
    expect(result.transaction.amount).toBe(25000);
    expect(state.transactions).toHaveLength(1);

    const saved = JSON.parse(
      globalThis.localStorage.getStoredValue()
    );

    expect(saved.transactions).toHaveLength(1);
  });

  test("rejects an empty item name", () => {
    const result = createTransaction({
      item: "   ",
      amount: 25000,
      category: "Food",
      date: "2026-11-13"
    });

    expect(result.success).toBe(false);
    expect(state.transactions).toHaveLength(0);
  });

  test("rejects an invalid amount", () => {
    for (const amount of [0, -100, "invalid", Infinity]) {
      const result = createTransaction({
        item: "Lunch",
        amount,
        category: "Food",
        date: "2026-11-13"
      });

      expect(result.success).toBe(false);
    }

    expect(state.transactions).toHaveLength(0);
  });

  test("rejects an unknown category", () => {
    const result = createTransaction({
      item: "Lunch",
      amount: 25000,
      category: "Unknown",
      date: "2026-11-13"
    });

    expect(result.success).toBe(false);
    expect(state.transactions).toHaveLength(0);
  });

  test("accepts a custom category", () => {
    state.customCategories = ["Shopping"];

    const result = createTransaction({
      item: "New notebook",
      amount: 30000,
      category: "Shopping",
      date: "2026-11-13"
    });

    expect(result.success).toBe(true);
    expect(state.transactions).toHaveLength(1);
  });

  test("rejects an invalid date", () => {
    const result = createTransaction({
      item: "Lunch",
      amount: 25000,
      category: "Food",
      date: "2026-02-30"
    });

    expect(result.success).toBe(false);
    expect(state.transactions).toHaveLength(0);
  });

  test("returns a warning when saving fails", () => {
  globalThis.localStorage.setItem = vi.fn(() => {
    throw new Error("Storage unavailable");
  });

  const result = createTransaction({
    item: "Lunch",
    amount: 25000,
    category: "Food",
    date: "2026-11-13"
  });

  expect(result.success).toBe(true);
  expect(result.saved).toBe(false);
  expect(state.transactions).toHaveLength(1);
  });
});


describe("Transaction history", () => {
  const olderTransaction = {
    id: "tx-older",
    item: "Bus fare",
    amount: 10000,
    category: "Transport",
    date: "2026-11-10",
    createdAt: 1000
  };

  const newerTransaction = {
    id: "tx-newer",
    item: "Lunch",
    amount: 25000,
    category: "Food",
    date: "2026-11-13",
    createdAt: 2000
  };

  const otherMonthTransaction = {
    id: "tx-december",
    item: "Movie",
    amount: 50000,
    category: "Fun",
    date: "2026-12-01",
    createdAt: 3000
  };

  beforeEach(() => {
    state.selectedMonth = "2026-11";
    state.sortKey = null;
    state.transactions = [
      olderTransaction,
      newerTransaction,
      otherMonthTransaction
    ];
  });

  test("shows only transactions from the selected month", () => {
    expect(getMonthlyTransactions()).toEqual([
      olderTransaction,
      newerTransaction
    ]);
  });

  test("sorts transactions newest first by default", () => {
    const result = sortTransactions([
      olderTransaction,
      newerTransaction
    ]);

    expect(result.map(transaction => transaction.id)).toEqual([
      "tx-newer",
      "tx-older"
    ]);
  });

  test("sorts transactions by amount from highest to lowest", () => {
    state.sortKey = "amount";

    const result = sortTransactions([
      olderTransaction,
      newerTransaction
    ]);

    expect(result.map(transaction => transaction.id)).toEqual([
      "tx-newer",
      "tx-older"
    ]);
  });

  test("sorts transactions by category alphabetically", () => {
    state.sortKey = "category";

    const result = sortTransactions([
      olderTransaction,
      newerTransaction
    ]);

    expect(result.map(transaction => transaction.category)).toEqual([
      "Food",
      "Transport"
    ]);
  });

  test("uses newer dates first when amounts are equal", () => {
    state.sortKey = "amount";

    const result = sortTransactions([
      olderTransaction,
      { ...newerTransaction, amount: olderTransaction.amount }
    ]);

    expect(result[0].id).toBe("tx-newer");
  });

  test("deletes a transaction and saves the updated data", () => {
    const result = deleteTransaction("tx-older");

    expect(result.success).toBe(true);
    expect(result.saved).toBe(true);
    expect(state.transactions.map(transaction => transaction.id)).toEqual([
      "tx-newer",
      "tx-december"
    ]);
  });

  test("returns failure when the transaction does not exist", () => {
    const result = deleteTransaction("missing-id");

    expect(result.success).toBe(false);
    expect(state.transactions).toHaveLength(3);
  });
});

