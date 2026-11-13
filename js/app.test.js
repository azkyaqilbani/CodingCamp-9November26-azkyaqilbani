/**
 * Property-based tests for StateManager — transaction operations
 * Uses fast-check with { numRuns: 100 }
 */


import fc from 'fast-check';
import { describe, test, expect } from 'vitest';
import { StateManager } from './app.js';

// ---------------------------------------------------------------------------
// Mock storage that always succeeds (mimics a working LocalStorageAdapter)
// ---------------------------------------------------------------------------
function makeMockStorage() {
  const store = {};
  return {
    save: (key, data) => { store[key] = JSON.stringify(data); return true; },
    load: (key) => { const v = store[key]; return v ? JSON.parse(v) : null; },
    isAvailable: () => true,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A non-empty string of printable ASCII, capped at 100 chars */
const itemArb = fc.stringOf(
  fc.char().filter(c => c >= ' ' && c !== '"'),
  { minLength: 1, maxLength: 100 }
);

/** Amount: a positive number rounded to 2 dp, within 0.01..999_999_999.99 */
const amountArb = fc
  .integer({ min: 1, max: 99_999_999_999 })
  .map(cents => Math.round(cents) / 100);

/** Category chosen from the three defaults */
const categoryArb = fc.constantFrom('Food', 'Transport', 'Fun');

/** A single valid transaction argument tuple */
const txArgArb = fc.tuple(itemArb, amountArb, categoryArb);

/** An array of 0–20 transaction argument tuples */
const txArgArrayArb = fc.array(txArgArb, { minLength: 0, maxLength: 20 });

/** An array of 1–20 transaction argument tuples (guaranteed non-empty) */
const nonEmptyTxArgArrayArb = fc.array(txArgArb, { minLength: 1, maxLength: 20 });

// ---------------------------------------------------------------------------
// Helper: populate a fresh StateManager with an array of [item, amount, category] tuples
// ---------------------------------------------------------------------------
function buildState(txArgs) {
  const sm = new StateManager(makeMockStorage());
  for (const [item, amount, category] of txArgs) {
    sm.addTransaction(item, amount, category);
  }
  return sm;
}

// ---------------------------------------------------------------------------
// Property 6: Transaction list default sort order
// Feature: expense-budget-visualizer, Property 6: Transaction list default sort order
// ---------------------------------------------------------------------------
describe('Property 6: Transaction list default sort order', () => {
  test('getTransactions(null) returns transactions newest-first for any set of transactions', () => {
    fc.assert(
      fc.property(txArgArrayArb, (txArgs) => {
        const sm = buildState(txArgs);
        const result = sm.getTransactions(null);

        // Must have same length as input
        expect(result).toHaveLength(txArgs.length);

        // Each adjacent pair must be in descending timestamp order
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].timestamp).toBeGreaterThanOrEqual(result[i].timestamp);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: Amount sort preserves descending order
// Feature: expense-budget-visualizer, Property 15: Amount sort preserves descending order
// ---------------------------------------------------------------------------
describe('Property 15: Amount sort preserves descending order', () => {
  test("getTransactions('amount') produces descending-by-amount order with timestamp tiebreaker", () => {
    fc.assert(
      fc.property(txArgArrayArb, (txArgs) => {
        const sm = buildState(txArgs);
        const result = sm.getTransactions('amount');

        expect(result).toHaveLength(txArgs.length);

        for (let i = 1; i < result.length; i++) {
          const prev = result[i - 1];
          const curr = result[i];

          if (prev.amount === curr.amount) {
            // Tiebreaker: descending timestamp
            expect(prev.timestamp).toBeGreaterThanOrEqual(curr.timestamp);
          } else {
            // Primary: descending amount
            expect(prev.amount).toBeGreaterThanOrEqual(curr.amount);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 16: Category sort preserves alphabetical order
// Feature: expense-budget-visualizer, Property 16: Category sort preserves alphabetical order
// ---------------------------------------------------------------------------
describe('Property 16: Category sort preserves alphabetical order', () => {
  test("getTransactions('category') produces case-insensitive ascending category order", () => {
    fc.assert(
      fc.property(txArgArrayArb, (txArgs) => {
        const sm = buildState(txArgs);
        const result = sm.getTransactions('category');

        expect(result).toHaveLength(txArgs.length);

        for (let i = 1; i < result.length; i++) {
          const prevCat = result[i - 1].category.toLowerCase();
          const currCat = result[i].category.toLowerCase();

          if (prevCat === currCat) {
            // Tiebreaker: descending timestamp
            expect(result[i - 1].timestamp).toBeGreaterThanOrEqual(result[i].timestamp);
          } else {
            // Primary: ascending alphabetical (case-insensitive)
            expect(prevCat <= currCat).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Delete transaction round-trip
// Feature: expense-budget-visualizer, Property 8: Delete transaction round-trip
// ---------------------------------------------------------------------------
describe('Property 8: Delete transaction round-trip', () => {
  test('deleteTransaction removes the target transaction and returns true', () => {
    fc.assert(
      fc.property(
        nonEmptyTxArgArrayArb,
        fc.integer({ min: 0, max: 19 }),
        (txArgs, pickIndex) => {
          const sm = buildState(txArgs);

          // Clamp the index to the actual number of transactions added
          const transactions = sm.getTransactions(null);
          const targetIndex = pickIndex % transactions.length;
          const target = transactions[targetIndex];
          const beforeCount = transactions.length;

          const result = sm.deleteTransaction(target.id);

          expect(result).toBe(true);

          const after = sm.getTransactions(null);
          expect(after).toHaveLength(beforeCount - 1);
          expect(after.find(t => t.id === target.id)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deleteTransaction returns false for a non-existent id', () => {
    fc.assert(
      fc.property(txArgArrayArb, (txArgs) => {
        const sm = buildState(txArgs);
        expect(sm.deleteTransaction('__nonexistent__')).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.10 — subscribe() and load() unit tests
// ---------------------------------------------------------------------------
describe('subscribe() — reactive subscriptions', () => {
  test('subscribe registers a listener that is called after addTransaction', () => {
    const sm = new StateManager(makeMockStorage());
    let callCount = 0;
    sm.subscribe(() => { callCount++; });

    sm.addTransaction('Coffee', 3.50, 'Food');
    expect(callCount).toBe(1);

    sm.addTransaction('Bus', 2.00, 'Transport');
    expect(callCount).toBe(2);
  });

  test('subscribe registers a listener that is called after deleteTransaction', () => {
    const sm = new StateManager(makeMockStorage());
    const tx = sm.addTransaction('Coffee', 3.50, 'Food');

    let callCount = 0;
    sm.subscribe(() => { callCount++; });

    sm.deleteTransaction(tx.id);
    expect(callCount).toBe(1);
  });

  test('subscribe registers a listener that is called after addCustomCategory', () => {
    const sm = new StateManager(makeMockStorage());
    let callCount = 0;
    sm.subscribe(() => { callCount++; });

    sm.addCustomCategory('Wellness');
    expect(callCount).toBe(1);
  });

  test('unsubscribe function removes listener — no more calls after unsubscribing', () => {
    const sm = new StateManager(makeMockStorage());
    let callCount = 0;
    const unsubscribe = sm.subscribe(() => { callCount++; });

    sm.addTransaction('Coffee', 3.50, 'Food');
    expect(callCount).toBe(1);

    unsubscribe();

    sm.addTransaction('Tea', 2.00, 'Fun');
    expect(callCount).toBe(1); // still 1 — listener was removed
  });

  test('multiple listeners are all notified', () => {
    const sm = new StateManager(makeMockStorage());
    let countA = 0;
    let countB = 0;
    sm.subscribe(() => { countA++; });
    sm.subscribe(() => { countB++; });

    sm.addTransaction('Coffee', 3.50, 'Food');
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  test('listener is not called when addTransaction fails (storage error)', () => {
    const { StateManager: SM } = require('./app.js');
    const failStorage = {
      save: () => false,
      load: () => null,
      isAvailable: () => false,
    };
    const sm = new SM(failStorage);
    let callCount = 0;
    sm.subscribe(() => { callCount++; });

    const result = sm.addTransaction('Coffee', 3.50, 'Food');
    expect(result).toBeNull();
    expect(callCount).toBe(0);
  });
});

describe('load() — state initialisation from storage', () => {
  test('load() reads valid transactions from storage and populates state', () => {
    const store = {};
    const mockStorage = {
      save: (key, data) => { store[key] = JSON.stringify(data); return true; },
      load: (key) => { const v = store[key]; return v ? JSON.parse(v) : null; },
      isAvailable: () => true,
    };

    // Pre-populate storage with two valid transactions
    const transactions = [
      { id: '1704067200000_a3f2g1', item: 'Lunch', amount: 15.50, category: 'Food', timestamp: 1704067200000 },
      { id: '1704153600000_b9k4m7', item: 'Bus fare', amount: 3.00, category: 'Transport', timestamp: 1704153600000 },
    ];
    store['expense_tracker_transactions'] = JSON.stringify(transactions);

    const sm = new StateManager(mockStorage);
    sm.load();

    expect(sm.storageError).toBe(false);
    expect(sm.getTransactions(null)).toHaveLength(2);
    expect(sm.getBalance()).toBeCloseTo(18.50, 2);
  });

  test('load() reads custom categories from storage and merges with defaults', () => {
    const store = {};
    const mockStorage = {
      save: (key, data) => { store[key] = JSON.stringify(data); return true; },
      load: (key) => { const v = store[key]; return v ? JSON.parse(v) : null; },
      isAvailable: () => true,
    };

    store['expense_tracker_transactions'] = JSON.stringify([]);
    store['expense_tracker_categories'] = JSON.stringify(['Shopping', 'Health']);

    const sm = new StateManager(mockStorage);
    sm.load();

    const categories = sm.getCategories();
    expect(categories).toContain('Food');
    expect(categories).toContain('Transport');
    expect(categories).toContain('Fun');
    expect(categories).toContain('Shopping');
    expect(categories).toContain('Health');
  });

  test('load() sets storageError and initialises empty state when storage returns null', () => {
    const failStorage = {
      save: () => false,
      load: () => null,
      isAvailable: () => false,
    };
    const sm = new StateManager(failStorage);
    sm.load();

    expect(sm.storageError).toBe(true);
    expect(sm.getTransactions(null)).toHaveLength(0);
    expect(sm.getCategories()).toEqual(['Food', 'Transport', 'Fun']);
    expect(sm.getBalance()).toBe(0);
  });

  test('load() silently discards transactions that fail schema validation', () => {
    const store = {};
    const mockStorage = {
      save: (key, data) => { store[key] = JSON.stringify(data); return true; },
      load: (key) => { const v = store[key]; return v ? JSON.parse(v) : null; },
      isAvailable: () => true,
    };

    const mixed = [
      // Valid
      { id: '1704067200000_valid1', item: 'Lunch', amount: 15.50, category: 'Food', timestamp: 1704067200000 },
      // Invalid: missing id
      { item: 'No ID', amount: 5.00, category: 'Fun', timestamp: 1704067200001 },
      // Invalid: amount out of range
      { id: '1704067200002_inv', item: 'Too cheap', amount: 0.001, category: 'Food', timestamp: 1704067200002 },
      // Invalid: timestamp is not an integer
      { id: '1704067200003_inv', item: 'Bad ts', amount: 2.00, category: 'Transport', timestamp: 1.5 },
      // Invalid: empty item
      { id: '1704067200004_inv', item: '', amount: 1.00, category: 'Fun', timestamp: 1704067200004 },
      // Valid
      { id: '1704153600000_valid2', item: 'Bus fare', amount: 3.00, category: 'Transport', timestamp: 1704153600000 },
    ];
    store['expense_tracker_transactions'] = JSON.stringify(mixed);
    store['expense_tracker_categories'] = JSON.stringify([]);

    const sm = new StateManager(mockStorage);
    sm.load();

    expect(sm.storageError).toBe(false);
    expect(sm.getTransactions(null)).toHaveLength(2); // only the two valid ones
  });

  test('load() initialises empty category list when categories key is absent', () => {
    const store = {};
    const mockStorage = {
      save: (key, data) => { store[key] = JSON.stringify(data); return true; },
      load: (key) => {
        if (key === 'expense_tracker_transactions') return [];
        return null; // categories key missing
      },
      isAvailable: () => true,
    };

    const sm = new StateManager(mockStorage);
    sm.load();

    expect(sm.storageError).toBe(false);
    // Only the three defaults — no crash
    expect(sm.getCategories()).toEqual(['Food', 'Transport', 'Fun']);
  });
});


