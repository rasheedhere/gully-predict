---
id: "005"
title: "Multi-Device Responsive Menu & Visual Regression Tests"
status: "open"
labels: ["ready-for-agent"]
blocked_by: ["002"]
---

## Parent

Blocked by [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)

## What to build

Write visual and responsive tests targeting multiple viewport heights, widths, and visual alignment constraints:
- Create `frontend/playwright/tests/visual-regression.spec.ts` and `frontend/playwright/tests/ios-pwa.spec.ts`.
- Implement full-page visual regression baseline matching (`toHaveScreenshot()`) for the Match Center page.
- Test responsive navbar menu:
  - On desktop viewports (e.g. 1280px), navbar links must show icons AND text labels.
  - On tablet viewports (768px-1023px), navbar link text labels must be hidden (display: none), showing only icons to avoid page overflow.
- Test mobile PWA characteristics:
  - Touch target check: Verify that all interactive links and buttons have bounding boxes of at least `44x44px`.
  - iOS safe areas: Verify headers and footer tabs have appropriate safe padding.

## Acceptance criteria

- [ ] Visual regression baseline screenshots created for desktop, tablet, and mobile.
- [ ] Navbar links hide text labels on tablet viewports and display them on desktop viewports.
- [ ] Bounding boxes for buttons/links checked programmatically to ensure touch targets meet Apple's HIG (`44x44px` minimum).
- [ ] Layout matches visual boundaries in mobile PWA viewports.

## Blocked by

- [docs/issues/002_shared_auth_setup.md](file:///Users/rasheed/Documents/git/gully-predict/docs/issues/002_shared_auth_setup.md)
