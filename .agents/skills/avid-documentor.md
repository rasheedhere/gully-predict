---
name: avid-documentor
description: Automatically updates architectural context, ADRs, and project documentation after code changes.
---

# Documentation & Decision Capture Rules
- **ADR Updates:** Every time a structural change is made (e.g., new microservice, dependency change, or UI refactor), look for files in `docs/`. Every change should have a decision record in `docs/GEMINI.md` or relevant READMEs or ADRs.
- **Context Sync:** After refactoring components, update `docs/GEMINI.md` or relevant READMEs to reflect the new component architecture or PWA state.
- **Key Decision Points:** Capture the "Why" behind a change. If a specific iOS HIG rule was prioritized over a web default, document the trade-off.
- **Traceability:** Link documentation updates to the specific commit or PR description currently being drafted.
- **Todo list:** Keep a `TODO.md` file in the project root and update it as needed.