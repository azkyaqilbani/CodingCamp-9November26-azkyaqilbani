# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that enables users to track personal expenses, visualize spending distribution by category, and review monthly summaries — all without a backend server. The application stores all data in the browser's Local Storage and is built using plain HTML, CSS, and Vanilla JavaScript. It provides an input form for logging transactions, a scrollable transaction list with delete capability, a live total balance display, and an interactive pie chart powered by Chart.js. Users can also define custom categories, sort their transaction list, and view spending grouped by month.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, an amount, and a category.
- **Category**: A classification label assigned to a Transaction. Default categories are Food, Transport, and Fun. Users may add custom categories.
- **Custom_Category**: A user-defined Category that extends the default set.
- **Transaction_List**: The scrollable, ordered collection of all recorded Transactions displayed in the UI.
- **Balance**: The running total calculated by summing the amounts of all stored Transactions.
- **Chart**: The pie chart component that visualises spending distribution across Categories.
- **Monthly_Summary**: A grouped view of Transactions filtered and aggregated by calendar month and year.
- **Local_Storage**: The browser's Web Storage API used for client-side persistence of all Transactions and Custom_Categories.
- **Form**: The input form used to create a new Transaction.
- **Validator**: The client-side logic responsible for checking Form field completeness and data correctness before a Transaction is committed.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can log a new expense quickly.

#### Acceptance Criteria

1. THE App SHALL render a Form containing an item name text field accepting up to 100 characters, a numeric amount field, a category selector, and a submit button.
2. THE Form's category selector SHALL include the options: Food, Transport, and Fun.
3. WHEN the user submits the Form with all fields filled and an amount value between 0.01 and 999,999,999.99 with up to 2 decimal places, THE App SHALL add a new Transaction to the Transaction_List and persist it to Local_Storage.
4. WHEN the user submits the Form with one or more empty fields, THE Validator SHALL display an inline error message adjacent to each empty field and SHALL NOT create a Transaction.
5. WHEN the user submits the Form with a non-positive, non-numeric, or out-of-range value in the amount field, THE Validator SHALL display an inline error message adjacent to the amount field and SHALL NOT create a Transaction.
6. WHEN a Transaction is successfully added, THE Form SHALL reset the item name field to empty, the amount field to empty, and the category selector to its first option.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see a scrollable list of all my recorded transactions so that I can review my spending history.

#### Acceptance Criteria

1. THE App SHALL render the Transaction_List as a scrollable container showing all persisted Transactions.
2. WHEN the Transaction_List is rendered, THE App SHALL display each Transaction's item name, amount formatted as a local currency symbol followed by a numeric value with exactly 2 decimal places, and Category.
3. WHEN the Transaction_List contains more items than the visible container height, THE App SHALL enable vertical scrolling within the container.
4. WHEN the App loads in the browser and Local_Storage contains one or more Transactions, THE App SHALL retrieve all Transactions from Local_Storage and render them in the Transaction_List sorted by most recently added first.
5. WHEN the App loads in the browser and Local_Storage contains no Transactions, THE App SHALL render the Transaction_List with an empty-state message indicating no transactions have been recorded.
6. IF Local_Storage is unavailable or contains unparseable Transaction data, THEN THE App SHALL render the Transaction_List as empty and display an error message indicating that transaction history could not be loaded.

---

### Requirement 3: Delete Transaction

**User Story:** As a user, I want to delete individual transactions so that I can remove incorrect or unwanted entries.

#### Acceptance Criteria

1. THE App SHALL render a delete control adjacent to each Transaction entry in the Transaction_List, visible without requiring hover or additional interaction.
2. WHEN the user activates the delete control for a Transaction, THE App SHALL immediately remove that Transaction from the Transaction_List display and permanently delete it from Local_Storage within 300 milliseconds.
3. IF Local_Storage fails to remove the Transaction, THEN THE App SHALL display an error message indicating the deletion failed and retain the Transaction in the Transaction_List.
4. WHEN a Transaction is deleted, THE App SHALL update the Balance and the Chart without requiring a page reload.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see my total balance at the top of the page so that I know how much I have spent in total.

#### Acceptance Criteria

1. THE App SHALL display the Balance as the sum of all Transaction amounts, positioned as the first visible element in the page layout.
2. WHEN a Transaction is added, THE App SHALL recalculate and update the Balance within 300 milliseconds, without requiring a page reload.
3. WHEN a Transaction is deleted, THE App SHALL recalculate and update the Balance within 300 milliseconds, without requiring a page reload.
4. WHEN the App loads, THE App SHALL calculate the Balance from all Transactions persisted in Local_Storage and display it before the user can interact with the Transaction_List.
5. IF Local_Storage is unavailable when the App loads, THEN THE App SHALL display a Balance of 0 and show an error message indicating that saved data could not be retrieved.

---

### Requirement 5: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE App SHALL render a Chart as a pie chart displaying the proportion of total Transaction amounts grouped by Category, including only Categories that have at least one Transaction.
2. WHEN a Transaction is added, THE App SHALL update the Chart to reflect the new spending distribution without a page reload.
3. WHEN a Transaction is deleted, THE App SHALL update the Chart to reflect the revised spending distribution without a page reload.
4. WHEN all Transactions are removed, THE App SHALL replace the Chart with a placeholder message indicating no spending data is available.
5. THE App SHALL load Chart.js from a CDN to render the Chart, requiring no local build tooling.
6. IF the Chart.js CDN resource fails to load, THEN THE App SHALL display an error message indicating the chart cannot be rendered.

---

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own expense categories so that I can classify transactions beyond the default options.

#### Acceptance Criteria

1. THE App SHALL provide a UI control for the user to enter and submit a new Custom_Category name of 1 to 50 characters after trimming leading and trailing whitespace.
2. WHEN the user submits a Custom_Category name that is non-empty after trimming and does not match an existing Category name in a case-insensitive comparison, THE App SHALL add it to the category selector in the Form and persist it to Local_Storage.
3. WHEN the user submits a Custom_Category name that is empty or whitespace-only after trimming, or that matches an existing Category name in a case-insensitive comparison, THE Validator SHALL display an inline error message stating the specific reason and SHALL NOT add the Custom_Category.
4. WHEN the App loads, THE App SHALL retrieve all persisted Custom_Categories from Local_Storage and include them in the category selector.
5. THE App SHALL display Custom_Categories in the Chart alongside the default Categories.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to view a summary of my spending grouped by month so that I can track how my expenses change over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary section that groups Transactions by the calendar month and year of each Transaction's recorded date.
2. WHEN the Monthly_Summary is displayed, THE App SHALL show the total amount spent per Category for each month.
3. WHEN the Monthly_Summary is displayed, THE App SHALL show the grand total amount spent for each month.
4. THE App SHALL display months in the Monthly_Summary in descending chronological order, with the most recent month appearing first.
5. WHEN no Transactions exist for a given month, THE App SHALL NOT display that month in the Monthly_Summary.
6. WHEN a Transaction is added or deleted, THE App SHALL update the Monthly_Summary immediately without requiring a page reload.

---

### Requirement 8: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category so that I can find and analyse entries more easily.

#### Acceptance Criteria

1. THE App SHALL provide a sort control that allows the user to select a sort key of either Amount or Category.
2. WHEN the user selects Amount as the sort key, THE App SHALL re-render the Transaction_List ordered from the highest amount to the lowest amount, using the Transaction's recorded date in descending order as a tiebreaker.
3. WHEN the user selects Category as the sort key, THE App SHALL re-render the Transaction_List ordered alphabetically by Category name using a case-insensitive comparison.
4. WHEN a new Transaction is added while a sort order is active, THE App SHALL insert the Transaction into the Transaction_List in the correct position according to the active sort key.
5. THE App SHALL maintain sort state only in memory and SHALL NOT persist the selected sort key to Local_Storage.

---

### Requirement 9: Client-Side Persistence

**User Story:** As a user, I want my transactions and custom categories to be saved automatically so that my data is still available when I reopen the browser.

#### Acceptance Criteria

1. THE App SHALL write all Transactions to Local_Storage immediately after each add or delete operation.
2. THE App SHALL write all Custom_Categories to Local_Storage immediately after each addition.
3. WHEN the App loads, THE App SHALL read all Transactions and Custom_Categories from Local_Storage before rendering the UI.
4. IF Local_Storage is unavailable, returns a parse error, or throws a quota-exceeded exception, THEN THE App SHALL display a persistent warning message to the user and SHALL initialise with an empty Transaction_List and an empty Custom_Category list.

---

### Requirement 10: Technical Stack Compliance

**User Story:** As a developer, I want the app to be built with plain HTML, CSS, and Vanilla JavaScript so that it has no build-step dependency and runs in any modern browser.

#### Acceptance Criteria

1. THE App SHALL be implemented using HTML, CSS, and Vanilla JavaScript only, with no JavaScript framework or transpilation step required.
2. THE App SHALL contain exactly one CSS file located in the `css/` directory.
3. THE App SHALL contain exactly one JavaScript file located in the `js/` directory.
4. THE App SHALL function correctly in the latest stable release of Chrome, Firefox, Edge, and Safari available at the time of delivery.
5. THE App SHALL not require a backend server or network request for any core functionality except loading Chart.js from a CDN.
