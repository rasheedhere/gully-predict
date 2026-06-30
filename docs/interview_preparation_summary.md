# Technical Interview Preparation Guide: Gully Predict Case Study

This document details the architectural changes, optimizations, and technical concepts implemented in the backend scoring engine and E2E test suite. Use this as a reference guide for system design, database performance, and testing strategy interview prep.

---

## 1. Executive Summary of Changes
We optimized a live sports prediction app (`gully-predict`) supporting 500K users and 50K private leagues:
1. **Scoring Engine Refactoring:** Replaced nested database queries with high-efficiency SQL aggregates, resolving connection queue backlogs.
2. **Transaction Scoping:** Shuffled `db.commit()` boundaries out of nested helper modules and moved them to the outer API router layer to prevent deadlocks.
3. **Leaderboard Cache Rebuild Optimizations:** Reduced database roundtrips for league calculations from $O(M \times L)$ down to $O(1)$ constant queries using SQL cross-league group-bys.
4. **Playwright E2E Test Suite Robustness:** Removed hardcoded fixtures and replaced them with dynamic API match discovery, making the test suite evergreen.

---

## 2. Core Concepts & Interview Q&A

### 🗄️ Concept A: N+1 Query Bottleneck
* **What is it?** An application pattern where the program fetches a list of parent rows (1 query) and then loops over each row to run a separate query to fetch child data (N queries), leading to $N+1$ database roundtrips.
* **How it manifested:** The private league leaderboard cache rebuilding loop ran 4 SQL queries (aggregating match points, campaign points, league-specific points, and checking database cache rows) for every user inside every league. For 50,000 leagues and 1.5M mappings, this resulted in **6.5 Million sequential SQL queries**.
* **How we optimized it:** 
  1. **Cross-League Grouping:** We queried all leagues and users in **3 total database queries** by leveraging compound SQL grouping (`group_by(league_id, user_id)`). 
  2. **Bulk Cache Check:** Fetched the entire `LeaderboardCache` state in a single query and mapped it into a Python hash map (`cache_map`), converting $O(N)$ database checks into $O(1)$ CPU lookups.

---

### 🔄 Concept B: Transaction Boundaries & Session Safety
* **What is it?** A transaction boundary defines when a set of database modifications are staged (`flush()`) vs finalized (`commit()`).
* **Why mid-request commits are dangerous:** If sub-routines (like scoring calculations or cache updates) commit mid-transaction, they terminate the session's transaction block. If subsequent write queries within the same request fail, they cannot be rolled back, causing data corruption. In multi-threaded or async environments, mid-request commits lead to **database session locks / deadlocks**.
* **How we optimized it:**
  * Replaced all intermediate `db.commit()` statements inside the scoring modules with `db.flush()`.
  * **Flush vs. Commit:** `flush()` writes SQL queries to the database transaction log but does not finalize them. `commit()` writes them permanently and closes the transaction.
  * We unified the commit to happen exactly once at the FastAPI router/endpoint layer when the request successfully completes.

---

### ⏳ Concept C: O(1) Performance Scaling & Memory Sizing
* **What is it?** Designing algorithms whose execution time is constant and independent of the input size ($O(1)$ complexity).
* **The "First-Match Kickoff" Shortcut:** Since $>95\%$ of users join their private leagues *before* a tournament kicks off, we cache the start time of the first match in Python memory. If `joined_at <= tournament_start`, we bypass the post-join SQL calculations entirely and copy the user's global total points directly in memory, saving CPU clock cycles on millions of iterations.
* **Hardware Sizing Logic:** At 500K users and 50K leagues (1.5M mappings), the active memory footprint of dictionary operations is under 500 MB. This means compute tasks can run on light containers (2 vCPU, 4GB RAM), shifting database sizing requirements from high-CPU to high-RAM (16GB) to keep active tables and indexes fully cached in Postgres's `shared_buffers`.

---

### 🧪 Concept D: Evergreen E2E Test Design
* **What is it?** Ensuring automated integration tests do not break as time passes due to data aging or test state mutations.
* **Why static fixtures fail:** Hardcoding a match ID (like `ipl-2026-02`) meant that once the test database graded the match, the prediction inputs disappeared, breaking the E2E predictions test.
* **How we optimized it:**
  * **Dynamic API Discovery:** The Playwright script queries the backend endpoint (`GET /api/matches`) dynamically during setup, filters for `status === 'upcoming'`, and asserts that the kickoff time is in the future.
  * **Mock Clocking:** Mocked the browser's global `Date` constructor in the test context to simulate a time in the future, verifying locking rules without halting the JavaScript event loop (which would happen if using page clock pauses).
