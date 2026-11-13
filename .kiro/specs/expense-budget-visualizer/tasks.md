# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a client-side expense tracking web app using plain HTML, CSS, and Vanilla JavaScript. All logic lives in a single `js/app.js` file organized into nine classes: `LocalStorageAdapter`, `Validator`, `StateManager`, `TransactionForm`, `TransactionList`, `BalanceDisplay`, `ChartRenderer`, `CategoryManager`, `MonthlySummary`, and `App`. A reactive subscription model keeps all UI components in sync after every state mutation.

## Tasks

- [x] 1. Set up project structure and entry point
  - Create `index.html` with semantic HTML skeleton: balance section, form section, category manager section, sort control, transaction list section, chart section, monthly summary section
  - Add `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>` CDN tag and `<script src="js/app.js" defer></script>`
  - Create `css/styles.css` with baseline reset, layout, and scrollable transaction list container styles
  - Create `js/app.js` as an empty module scaffold with class stubs for all nine components
  - _Requirements: 10.1, 10.2, 10.3, 5.5_

- [ ] 2. Implement LocalStorageAdapter and StateManager core
  - [x] 2.1 Implement `LocalStorageAdapter`
    - Write static `isAvailable()`, `save(key, data)`, and `load(key)` methods
    - Handle `SecurityError`, `QuotaExceededError`, and `SyntaxError` — return `null`/`false` on failure
    - _Requirements: 9.1, 9.2, 9.3, 9.4_


  - [x] 2.3 Implement `StateManager` — transaction operations
    - Write `addTransaction(item, amount, category)`: assigns `id` (timestamp + 6-char random suffix) and `timestamp`, appends to list, calls `save()`, notifies subscribers; returns `Transaction | null`
    - Write `deleteTransaction(transactionId)`: removes by id, calls `save()`, notifies subscribers; returns `boolean`
    - Write `getTransactions(sortKey)`: returns sorted copy — `null` = newest-first, `'amount'` = desc amount + desc timestamp tiebreaker, `'category'` = case-insensitive alpha + desc timestamp tiebreaker
    - _Requirements: 1.3, 3.2, 8.2, 8.3, 9.1_


  - [x] 2.6 Implement `StateManager` — category operations and derived data
    - Write `addCustomCategory(name)`: validates uniqueness (case-insensitive), appends, persists custom categories key, notifies; returns `boolean`
    - Write `getCategories()`: returns default `["Food", "Transport", "Fun"]` merged with custom categories
    - Write `getBalance()`: sum of all transaction amounts, 2 decimal precision
    - Write `getCategoryTotals()`: returns `Map<string, number>` for categories with at least one transaction
    - Write `getMonthlySummary()`: groups transactions by `YYYY-MM`, computes per-category totals and grand total, sorts descending
    - _Requirements: 4.1, 5.1, 6.2, 7.1, 7.2, 7.3, 7.4, 9.2_


  - [x] 2.10 Implement `StateManager` — `subscribe`, `load`, and storage-error state
    - Write `subscribe(listener)`: registers callback, returns unsubscribe function; fires all listeners after every mutation
    - Write `load()`: reads both Local Storage keys, validates each transaction against schema (discard invalid), merges custom categories; sets `storageError` flag and initializes empty state if adapter returns `null`
    - _Requirements: 2.4, 2.6, 4.4, 6.4, 9.3, 9.4_

- [ ] 3. Implement Validator
  - [ ] 3.1 Implement `Validator.validateTransactionForm`
    - Validate item name: non-empty after trim, â‰¤100 chars
    - Validate amount: numeric, 0.01—999,999,999.99, â‰¤2 decimal places
    - Validate category: non-empty string present in category list
    - Return `ValidationResult` with `isValid` boolean and `errors` Map
    - _Requirements: 1.4, 1.5_

  - [ ] 3.4 Implement `Validator.validateCustomCategory`
    - Trim name; reject if empty/whitespace or case-insensitive match against `existingCategories`
    - Return `ValidationResult` with specific error messages per rejection reason
    - _Requirements: 6.3_

  - [ ] 3.6 Implement `Validator.formatAmount` and `Validator.sanitizeText`
    - `formatAmount(amount)`: parses string to float, rounds to 2 decimal places, returns `number | null`
    - `sanitizeText(text, maxLength)`: trims and truncates to `maxLength`, returns string
    - _Requirements: 1.3, 6.1_

- [ ] 4. Checkpoint — core logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement TransactionForm
  - [ ] 5.1 Implement `TransactionForm.render`
    - Render form with item name `<input>` (maxlength=100), amount `<input type="number">`, category `<select>` populated from `getCategories()`, and submit `<button>`
    - Attach `submit` event: call `Validator.validateTransactionForm`, show errors on failure, call `stateManager.addTransaction()` and `reset()` on success
    - Add `role="alert"` to each inline error placeholder element
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 5.2 Implement `TransactionForm.reset` and `TransactionForm.updateCategories`
    - `reset()`: clear item name, clear amount, reset selector to index 0
    - `updateCategories(categories)`: rebuild `<option>` elements in selector from new category list
    - _Requirements: 1.6, 6.2_


- [ ] 6. Implement BalanceDisplay
  - [ ] 6.1 Implement `BalanceDisplay.render`
    - Display balance as first visible element, formatted as currency symbol + numeric value with exactly 2 decimal places
    - Subscribe to `StateManager`; re-render within 300ms on any state change
    - _Requirements: 4.1, 4.2, 4.3, 4.4_


- [ ] 7. Implement TransactionList
  - [ ] 7.1 Implement `TransactionList.render`
    - Render each transaction as `<li>` showing item name, category, and amount formatted as currency symbol + 2 decimal places
    - Render always-visible delete `<button>` with `aria-label` per entry
    - Attach delete button click: call `stateManager.deleteTransaction(id)`; on `false` return, show inline delete-failure notification that auto-dismisses after 5 seconds
    - Subscribe to `StateManager`; re-render list on state change using active sort key
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_


  - [ ] 7.4 Implement `TransactionList.renderEmptyState`
    - Render empty-state message when transaction list is empty
    - _Requirements: 2.5_

  - [ ] 7.5 Implement `TransactionList.setSortKey` and sort integration
    - Wire sort control `<select>` (Amount / Category options) to `setSortKey()`
    - On sort key change, re-render list in new order; maintain sort key in memory only (no Local Storage write)
    - When a new transaction is added while sort is active, re-render in correct sorted position
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_


- [ ] 8. Checkpoint — list and balance complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement ChartRenderer
  - [ ] 9.1 Implement `ChartRenderer.render` and `ChartRenderer.update`
    - `render(canvasElement, categoryTotals)`: create Chart.js pie chart instance with labels and data from `categoryTotals` Map; filter out zero-total categories
    - `update(categoryTotals)`: update existing chart instance's data and call `chart.update()`
    - Subscribe to `StateManager`; call `update()` within 300ms on state change
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 9.2 Implement `ChartRenderer.renderPlaceholder` and CDN failure handling
    - `renderPlaceholder(containerElement)`: replace canvas with placeholder message when no transactions exist
    - Detect Chart.js CDN load failure via `window.onerror` or `<script onerror>`; display error message inside chart container
    - _Requirements: 5.4, 5.6_


- [ ] 10. Implement CategoryManager
  - [ ] 10.1 Implement `CategoryManager.render`
    - Render `<input>` (maxlength=50) and submit control for new custom category
    - Attach submit: call `Validator.validateCustomCategory`, show inline error with `role="alert"` on failure, call `stateManager.addCustomCategory()` and clear input on success
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 11. Implement MonthlySummary
  - [ ] 11.1 Implement `MonthlySummary.render`
    - Render summary section grouping transactions by `YYYY-MM` in descending order
    - Each month group shows category totals and grand total; skip months with no transactions
    - Subscribe to `StateManager`; re-render on state change
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 12. Implement App — initialization and wiring
  - [ ] 12.1 Implement `App` initialization
    - Instantiate `LocalStorageAdapter`, call `StateManager.load()`; display persistent storage-error banner if `storageError` is set
    - Instantiate and render all components into their respective DOM containers
    - Subscribe `TransactionForm.updateCategories` to `StateManager` so it refreshes on custom category additions
    - _Requirements: 2.4, 2.6, 4.4, 4.5, 6.4, 9.3, 9.4_


- [ ] 13. Implement error handling and accessibility polish
  - [ ] 13.1 Wire all error banners and inline notifications
    - Persistent top-of-page banner for storage unavailable / quota exceeded / corrupt data (Req 2.6, 4.5, 9.4)
    - Inline error in chart container for CDN failure (Req 5.6)
    - Delete-failure notification auto-dismissing after 5 seconds (Req 3.3)
    - _Requirements: 2.6, 3.3, 4.5, 5.6, 9.4_

  - [ ] 13.2 Accessibility pass
    - Add `aria-label` to all icon-only delete buttons
    - Ensure all inline error elements have `role="alert"`
    - Verify semantic HTML elements used throughout (`<form>`, `<button>`, `<ul>`, `<li>`, `<section>`)
    - Verify all form controls and buttons are keyboard navigable
    - _Requirements: 3.1, 1.4, 1.5_

- [ ] 14. Final checkpoint — full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each property-based test uses `fast-check` with `{ numRuns: 100 }` and a tag comment: `// Feature: expense-budget-visualizer, Property N: <property_text>`
- Unit tests use Vitest; run with `vitest --run` for single execution
- All 17 correctness properties from the design map to property-based test sub-tasks spread across relevant implementation tasks
- Checkpoints at tasks 4, 8, and 14 validate incremental progress before moving to the next phase
- Sort state is in-memory only — never write `sortKey` to Local Storage (Req 8.5)
- The `App` class is the sole entry point; all components are wired inside `App.init()`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.6"] },
    { "id": 1, "tasks": ["2.3", "2.6", "2.10", "3.1", "3.4"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.5", "2.7", "2.8", "2.9", "3.2", "3.3", "3.5"] },
    { "id": 3, "tasks": ["5.1", "5.2", "6.1", "7.4", "11.1"] },
    { "id": 4, "tasks": ["5.3", "6.2", "7.1", "9.1", "9.2", "10.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.5", "9.3", "10.2", "10.3"] },
    { "id": 6, "tasks": ["7.6", "7.7", "7.8", "12.1"] },
    { "id": 7, "tasks": ["12.2", "13.1", "13.2"] }
  ]
}
```
