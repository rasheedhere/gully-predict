---
name: build-master
description: Checklist for Antigravity agent post‑change verification and build.
---

# Build‑Master Checklist for Antigravity Agent

This skill provides a **post‑change checklist** that the Antigravity agent should run after any code modifications. It ensures the project stays stable, the UI respects iOS‑PWA standards, and the production assets can be built without errors.

---

## ✅ Checklist Items

1. **Run Type‑checking & Lint**
   - `npm run lint` – ensure TypeScript compiles (`tsc --noEmit`) and ESLint passes.
2. **Execute Unit & Integration Tests**
   - `npm run test` – run Vitest front‑end tests.
   - `pytest` – run back‑end tests.
3. **Build Production Bundle & Verify Backend Python**
   - `npm run build` – generate the optimized static assets in `frontend/dist/`.
   - Verify the build succeeds with **zero** errors or warnings.
   - `./.venv/bin/python -m compileall backend` – ensure backend python files compile without syntax errors.
   - `./.venv/bin/python -c "import pkgutil; import importlib; [importlib.import_module(n) for _, n, _ in pkgutil.walk_packages(['backend'], 'backend.')]"` – verify all backend python modules can be imported without syntax or runtime import errors.
4. **Validate iOS‑PWA Safety**
   - Check that `manifest.json` contains `display: "standalone"`.
   - Confirm generated HTML includes the required meta tags (`viewport-fit=cover`, `apple-mobile-web-app-status-bar-style`).
   - Ensure all interactive components have **≥44 × 44 pt** touch targets.
5. **Documentation Sync**
   - Run the `avid-documentor` skill to refresh `docs/GEMINI.md` and any other markdown artifacts.

---

## 📦 Quick Run Script (optional)

You can automate the above steps with a single npm script:
```json
// package.json
"scripts": {
  "verify": "npm run lint && npm run test && npm run build && echo 'All checks passed'"
}
```
Run:
```bash
npm run verify
```

---

*Last updated: 2026‑05‑28*
