---
name: ios-pwa-ux-standards
description: Enforces Apple HIG for safe areas and touch targets, with specific optimizations for PWA standalone mode on iOS.
---

# iOS PWA & Mobile-First Technical Standards

## 1. PWA Manifest & iOS Meta Tags
- **Standalone Mode:** Ensure `display: standalone` is set in `manifest.json`.
- **Status Bar:** Use `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` to allow the background color to bleed into the status bar area.
- **App Icons:** Always provide a `link[rel="apple-touch-icon"]` (180x180px) to ensure a high-quality icon on the iOS home screen.
- **Splash Screens:** Generate specific `apple-touch-startup-image` links for various iPhone resolutions to prevent a blank white flash during app launch.

## 2. Viewport & Safe Areas (The "Cover" Principle)
- **Viewport:** `viewport-fit=cover` is mandatory to avoid white bars on the sides of the iPhone notch.
- **Global Insets:** 
  - `padding-top: env(safe-area-inset-top)` for fixed headers.
  - `padding-bottom: env(safe-area-inset-bottom)` for bottom navigation.
- **Interactive Logic:** Ensure no critical UI (like "X" close buttons) sits in the top-left/right corners where the notch or clock might overlap.

## 3. Interaction & Haptics
- **Touch Targets:** Minimum **44x44pt** hit area.
- **Disable Callouts:** Use `-webkit-touch-callout: none` on UI elements (like nav icons) to prevent the iOS system context menu from appearing on a long-press.
- **Smooth Scrolling:** Use `-webkit-overflow-scrolling: touch` for overflow containers to maintain momentum scrolling.
- **Haptics:** Integrate the Web Vibration API for critical success/error actions to mimic native iOS haptics.

## 4. Typography & Inputs
- **No Auto-Zoom:** Set input `font-size: 16px` minimum.
- **System Fonts:** Prioritize `-apple-system, BlinkMacSystemFont` to use SF Pro.
- **Keyboard Optimization:** Use `enterkeyhint` (e.g., "search", "done", "next") to customize the iOS keyboard action button.

## 5. PWA Utility Logic
- **Offline UI:** Provide a "No Connection" state that matches the iOS system style (centered icon with subtle grey text).
- **Navigation:** Since PWAs lack a browser "Back" button, ensure every sub-page has a clear, iOS-style "Back" chevron in the top-left header.