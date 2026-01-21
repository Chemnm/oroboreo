# Cookie Crumbs - Task List

<!--
============================================================================
COOKIE-CRUMBS.MD - The Task List (like PRD.md)
============================================================================

This file contains the tasks that oreo-run.js will execute autonomously.
Each task is processed in order. When a task is complete, the agent marks
it [x] and moves to the next one.

USAGE:
  1. Define your feature/session name
  2. Add tasks in the format shown below
  3. Run: node oroboreo/utils/oreo-run.js
  4. Watch the magic happen!

TASK FORMAT:
  - [ ] **Task N: Title** [SIMPLE|COMPLEX|CRITICAL]
    - **Objective:** What needs to be done
    - **Files:** Which files to modify
    - **Details:**
      - Step 1
      - Step 2
    - **Verification:** How to verify it works

COMPLEXITY TAGS:
  [SIMPLE]   → Uses Haiku ($1/$5 per 1M tokens) - fast, cheap
  [COMPLEX]  → Uses Sonnet ($3/$15 per 1M tokens) - balanced
  [CRITICAL] → Uses Sonnet with extra care - important tasks

TIP: The more detail you provide, the better the agent performs!

============================================================================
-->

**Session**: my-feature-name
**Created**: <!-- Add date -->
**Status**: In Progress

---

## Tasks

- [ ] **Task 1: Example Task** [SIMPLE]
  - **Objective:** Describe what needs to be accomplished
  - **Files:** `src/example.js`, `src/utils.js`
  - **Details:**
    - Step 1: Do this first
    - Step 2: Then do this
    - Step 3: Finally verify
  - **Verification:** Run `npm test` and ensure all pass

- [ ] **Task 2: Another Task** [COMPLEX]
  - **Objective:** A more complex task
  - **Files:** `src/api/`, `src/database/`
  - **Details:**
    - Implement the feature
    - Add error handling
    - Write tests
  - **Verification:** Manual testing + unit tests

---

## 🕵️ Human UI Verification

After all tasks complete, verify:
- [ ] Feature works as expected
- [ ] No regressions introduced
- [ ] Code is clean and documented
