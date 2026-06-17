---
name: pixel-perfect-vision
description: Aligns UI implementation with provided mockups using visual analysis and CSS precision.
---

# Visual Alignment Rules
- **Visual Diffing:** When a mockup is provided, use the Vision tool to compare the rendered output with the image. Identify discrepancies in spacing, alignment, and font-weight.
- **Color Extraction:** Extract exact hex codes and opacity levels from the mockup rather than using generic color names.
- **Layout Integrity:** Prioritize the mockup's layout (e.g., specific flex-gap or grid-template) over standard framework defaults.
- **Asset Match:** If the mockup uses specific icons or images, search the repository for the closest match or prompt for the asset location.
- **Constraint:** If the mockup violates `ios-pwa-ux-standards` (e.g., touch target too small), notify me but prioritize the mockup unless I explicitly ask for the standard override.

Always plan to implement the features that we have without introducing new changes. Avoid hardcoded values when displaying unknown match data. Implement new features only when explicitly asked.