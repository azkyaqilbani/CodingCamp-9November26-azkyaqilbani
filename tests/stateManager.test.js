/**
 * Property-based tests for StateManager — category operations and derived data
 * Task 2.6 — Properties 9, 10, 11, 12, 14
 * Uses fast-check with { numRuns: 100 }
 */


import fc from 'fast-check';
import { describe, test, expect } from 'vitest';
import { StateManager } from '../js/app.js';

// ---------------------------------------------------------------------------
// Mock storage that always succeeds
// ---------------------------------------------------------------------------
function makeMockStorage() {
  const store = {};
  return {
    save: (key, data) => { store[key] = JSON.stringify(data); return true; },
    load: (key) => { const v = store[key]; return v ? JSON.parse(v) : null; },
    isAvailable: () => true,
  };
}

// Mock storage that always fails on save (simulates quota exceeded / unavailable)
function makeFailingStorage() {
  return {
    save: () => false,
    load: () => null,
    isAvailable: () => false,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-empty printable ASCII string, max 100 chars */
const itemArb = fc.stringOf(
  fc.char().filter(c => c >= ' ' && c !== '"'),
  { minLength: 1, maxLength: 100 }
);

/** Positive amount: integer cents 1–99,999,999,999 → divided by 100 */
const amountArb = fc
  .integer({ min: 1, max: 99_999_999_999 })
  .map(cents => Math.round(cents) / 100);

/** Default categories */
const categoryArb = fc.constantFrom('Food', 'Transport', 'Fun');

/** [item, amount, category] tuple */
const txArgArb = fc.tuple(itemArb, amountArb, categoryArb);

/** 0–20 transaction argument tuples */
const txArgArrayArb = fc.array(txArgArb, { minLength: 0, maxLength: 20 });

/** 1–20 transaction argument tuples */
const nonEmptyTxArgArrayArb = fc.array(txArgArb, { minLength: 1, maxLength: 20 });

/**
 * Custom category names: 1–50 non-whitespace printable chars (after trim safe).
 * We avoid names that case-insensitively match the defaults.
 */
const DEFAULT_LOWER = new Set(['food', 'transport', 'fun']);

const customCategoryNameArb = fc
  .stringOf(
    fc.char().filter(c => c > ' '),  // printable, non-space
    { minLength: 1, maxLength: 50 }
  )
  .filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 && !DEFAULT_LOWER.has(trimmed.toLowerCase());
  });

// ---------------------------------------------------------------------------
// Helper: populate a fresh StateManager
// ---------------------------------------------------------------------------
function buildState(txArgs, storage) {
  const sm = new StateManager(storage || makeMockStorage());
  for (const [item, amount, category] of txArgs) {
    sm.addTransaction(item, amount, category);
  }
  return sm;
}

// ---------------------------------------------------------------------------
// Property 9: Balance equals sum of all transactions
// Feature: expense-budget-visualizer, Property 9: Balance equals sum of all transactions
// ---------------------------------------------------------------------------
describe('Property 9: Balance equals sum of all transactions', () => {
  test('getBalance() equals arithmetic sum of all transaction amounts', () => {
    fc.assert(
      fc.property(txArgArrayArb, (txArgs) => {
        const sm = buildState(txArgs);

        const expected = Math.round(
          txArgs.reduce((sum, [, amount]) => sum + amount, 0) * 100
        ) / 100;

        expect(sm.getBalance()).toBeCloseTo(expected, 2);
      }),
      { numRuns: 100 }
    );
  });

  test('getBalance() returns 0 when no transactions exist', () => {
    const sm = new StateManager(makeMockStorage());
    expect(sm.getBalance()).toBe(0);
  });

  test('getBalance() updates correctly after a transaction is deleted', () => {
    fc.assert(
      fc.property(
        nonEmptyTxArgArrayArb,
        fc.integer({ min: 0, max: 19 }),
        (txArgs, pickIndex) => {
          const sm = buildState(txArgs);
          const transactions = sm.getTransactions(null);
          const target = transactions[pickIndex % transactions.length];

          const balanceBefore = sm.getBalance();
          sm.deleteTransaction(target.id);

          const expectedAfter = Math.round((balanceBefore - target.amount) * 100) / 100;
          expect(sm.getBalance()).toBeCloseTo(expectedAfter, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Chart reflects current category totals
// Feature: expense-budget-visualizer, Property 10: Chart reflects current category totals
// ---------------------------------------------------------------------------
describe('Property 10: Chart reflects current category totals', () => {
  test('getCategoryTotals() has exactly one entry per category with >=1 transaction', () => {
    fc.assert(
      fc.property(txArgArrayArb, (txArgs) => {
        const sm = buildState(txArgs);
        const totals = sm.getCategoryTotals();

        // Build expected totals from txArgs
        const expectedMap = new Map();
        for (const [, amount, category] of txArgs) {
          expectedMap.set(category, (expectedMap.get(category) || 0) + amount);
        }

        // Filter out zero entries (defensive)
        for (const [cat, total] of expectedMap) {
          if (total <= 0) expectedMap.delete(cat);
        }

        // Same set of keys
        expect(totals.size).toBe(expectedMap.size);
        for (const [cat, expected] of expectedMap) {
          expect(totals.has(cat)).toBe(true);
          expect(totals.get(cat)).toBeCloseTo(expected, 2);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('getCategoryTotals() excludes categories with no transactions', () => {
    fc.assert(
      fc.property(txArgArrayArb, (txArgs) => {
        const sm = buildState(txArgs);
        const totals = sm.getCategoryTotals();

        // Every entry in the map must have a positive total
        for (const [, total] of totals) {
          expect(total).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('getCategoryTotals() returns empty map when no transactions exist', () => {
    const sm = new StateManager(makeMockStorage());
    expect(sm.getCategoryTotals().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property 11: Valid custom category addition round-trip
// Feature: expense-budget-visualizer, Property 11: Valid custom category addition round-trip
// ---------------------------------------------------------------------------
describe('Property 11: Valid custom category addition round-trip', () => {
  test('adding a valid unique category returns true and appears in getCategories()', () => {
    fc.assert(
      fc.property(customCategoryNameArb, (name) => {
        const sm = new StateManager(makeMockStorage());
        const result = sm.addCustomCategory(name);

        expect(result).toBe(true);
        // Category (trimmed) should now be in the list
        const categories = sm.getCategories();
        expect(categories.map(c => c.toLowerCase())).toContain(name.trim().toLowerCase());
      }),
      { numRuns: 100 }
    );
  });

  test('added custom category is reflected in a subsequent getCategories() call', () => {
    fc.assert(
      fc.property(
        fc.array(customCategoryNameArb, { minLength: 1, maxLength: 5 }),
        (names) => {
          const sm = new StateManager(makeMockStorage());
          const added = [];

          for (const name of names) {
            const trimmed = name.trim();
            const existing = sm.getCategories().map(c => c.toLowerCase());
            if (!existing.includes(trimmed.toLowerCase())) {
              sm.addCustomCategory(name);
              added.push(trimmed);
            }
          }

          const categories = sm.getCategories().map(c => c.toLowerCase());
          for (const cat of added) {
            expect(categories).toContain(cat.toLowerCase());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getCategories() always starts with the three defaults', () => {
    fc.assert(
      fc.property(
        fc.array(customCategoryNameArb, { minLength: 0, maxLength: 5 }),
        (names) => {
          const sm = new StateManager(makeMockStorage());
          for (const name of names) {
            sm.addCustomCategory(name);
          }
          const cats = sm.getCategories();
          expect(cats[0]).toBe('Food');
          expect(cats[1]).toBe('Transport');
          expect(cats[2]).toBe('Fun');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Invalid custom category rejected
// Feature: expense-budget-visualizer, Property 12: Invalid custom category rejected
// ---------------------------------------------------------------------------
describe('Property 12: Invalid custom category rejected', () => {
  test('empty or whitespace-only name returns false and is not added', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 20 }),
        (name) => {
          const sm = new StateManager(makeMockStorage());
          const before = sm.getCategories().length;
          const result = sm.addCustomCategory(name);

          expect(result).toBe(false);
          expect(sm.getCategories().length).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('duplicate name (case-insensitive) returns false and is not added again', () => {
    fc.assert(
      fc.property(customCategoryNameArb, (name) => {
        const sm = new StateManager(makeMockStorage());

        // First addition should succeed
        sm.addCustomCategory(name);
        const countAfterFirst = sm.getCategories().length;

        // Second addition of the same name (various case combos)
        const result = sm.addCustomCategory(name.toUpperCase());
        expect(result).toBe(false);
        expect(sm.getCategories().length).toBe(countAfterFirst);
      }),
      { numRuns: 100 }
    );
  });

  test('adding a name that matches a default category (case-insensitive) returns false', () => {
    const sm = new StateManager(makeMockStorage());

    expect(sm.addCustomCategory('food')).toBe(false);
    expect(sm.addCustomCategory('TRANSPORT')).toBe(false);
    expect(sm.addCustomCategory('Fun')).toBe(false);
    expect(sm.addCustomCategory('FUN')).toBe(false);

    // Length stays at 3 (defaults only)
    expect(sm.getCategories().length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Property 14: Monthly summary grouping correctness
// Feature: expense-budget-visualizer, Property 14: Monthly summary grouping correctness
// ---------------------------------------------------------------------------
describe('Property 14: Monthly summary grouping correctness', () => {
  /**
   * Build an arbitrary with transactions spread across multiple months.
   * We generate timestamps clamped to 2020-01-01 to 2025-12-31 so the
   * YYYY-MM derivation is deterministic.
   */
  const timestampArb = fc.integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2025-12-31').getTime(),
  });

  const txWithTimestampArb = fc.record({
    item: itemArb,
    amount: amountArb,
    category: categoryArb,
    timestamp: timestampArb,
  });

  /**
   * We inject transactions directly into state to control timestamps
   * (bypassing addTransaction which uses Date.now()).
   */
  function buildStateWithTimestamps(txRecords) {
    const sm = new StateManager(makeMockStorage());
    for (const r of txRecords) {
      const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
      sm._transactions.push({
        id: `${r.timestamp}_${suffix}`,
        item: r.item,
        amount: r.amount,
        category: r.category,
        timestamp: r.timestamp,
      });
    }
    return sm;
  }

  test('getMonthlySummary() contains exactly one group per distinct YYYY-MM', () => {
    fc.assert(
      fc.property(
        fc.array(txWithTimestampArb, { minLength: 0, maxLength: 20 }),
        (txRecords) => {
          const sm = buildStateWithTimestamps(txRecords);
          const summary = sm.getMonthlySummary();

          // Compute expected keys
          const expectedKeys = new Set(
            txRecords.map(r => {
              const d = new Date(r.timestamp);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            })
          );

          expect(summary.size).toBe(expectedKeys.size);
          for (const key of expectedKeys) {
            expect(summary.has(key)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getMonthlySummary() grand totals equal sum of transactions per month', () => {
    fc.assert(
      fc.property(
        fc.array(txWithTimestampArb, { minLength: 1, maxLength: 20 }),
        (txRecords) => {
          const sm = buildStateWithTimestamps(txRecords);
          const summary = sm.getMonthlySummary();

          // Compute expected grand totals per month
          const expectedTotals = new Map();
          for (const r of txRecords) {
            const d = new Date(r.timestamp);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            expectedTotals.set(key, (expectedTotals.get(key) || 0) + r.amount);
          }

          for (const [key, expected] of expectedTotals) {
            const group = summary.get(key);
            expect(group).toBeDefined();
            expect(group.grandTotal).toBeCloseTo(expected, 2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getMonthlySummary() groups are sorted descending (most recent first)', () => {
    fc.assert(
      fc.property(
        fc.array(txWithTimestampArb, { minLength: 1, maxLength: 20 }),
        (txRecords) => {
          const sm = buildStateWithTimestamps(txRecords);
          const summary = sm.getMonthlySummary();
          const keys = [...summary.keys()];

          for (let i = 1; i < keys.length; i++) {
            // Descending: each key should be <= the previous one
            expect(keys[i - 1] >= keys[i]).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getMonthlySummary() per-category totals are correct within each month', () => {
    fc.assert(
      fc.property(
        fc.array(txWithTimestampArb, { minLength: 1, maxLength: 20 }),
        (txRecords) => {
          const sm = buildStateWithTimestamps(txRecords);
          const summary = sm.getMonthlySummary();

          // Build expected category totals per month
          const expected = new Map();
          for (const r of txRecords) {
            const d = new Date(r.timestamp);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!expected.has(key)) expected.set(key, new Map());
            const catMap = expected.get(key);
            catMap.set(r.category, (catMap.get(r.category) || 0) + r.amount);
          }

          for (const [key, catMap] of expected) {
            const group = summary.get(key);
            expect(group).toBeDefined();
            for (const [cat, total] of catMap) {
              expect(group.categoryTotals.has(cat)).toBe(true);
              expect(group.categoryTotals.get(cat)).toBeCloseTo(total, 2);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getMonthlySummary() returns empty map when no transactions exist', () => {
    const sm = new StateManager(makeMockStorage());
    expect(sm.getMonthlySummary().size).toBe(0);
  });
});


