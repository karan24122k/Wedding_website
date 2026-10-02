/**
 * Kumar Video & Photography - Lightweight Page Transition Coordinator (Phase 7)
 *
 * Core Architecture & Constraints:
 * 1. Zero Artificial Delay: Native browser navigation is never delayed or blocked.
 * 2. Unhindered Special Links:
 *    - Never intercepts target="_blank", external domains, tel:, mailto:, wa.me, or hash anchors (#).
 *    - Never intercepts modifier clicks (Ctrl, Cmd, Shift, Alt, middle-click).
 * 3. Back / Forward Cache Resilient:
 *    - pageshow listener immediately removes exit fade classes upon BFCache restore.
 * 4. Reduced Motion Aware:
 *    - prefers-reduced-motion: reduce disables all transition effects.
 * 5. Native Fallback:
 *    - If JavaScript fails, standard browser navigation functions normally.
 */

(function(window) {
  'use strict';

  function initPageTransitions() {
    // 1. Reduced motion check
    const isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) return;

    // 2. Add entry transition class
    document.body.classList.add('page-ready');

    // 3. Handle BFCache (Back/Forward navigation restoration)
    window.addEventListener('pageshow', (event) => {
      document.body.classList.remove('page-exiting');
      document.body.classList.add('page-ready');
    });

    // 4. Delegated link click handler for internal pages
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Ignore external, target blank, anchors, or protocols
      if (
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('https://wa.me') ||
        href.startsWith('http://') ||
        href.startsWith('https://') && !href.startsWith(window.location.origin)
      ) {
        return;
      }

      // Ignore modifier keys
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }

      // Check if same page hash
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.hash) {
        return; // Normal anchor jump
      }

      // If modern CSS View Transitions are active, let browser manage seamlessly
      if (document.startViewTransition) {
        return; // Handled natively by @view-transition in styles.css
      }

      // Graceful micro-fade for non-ViewTransition browsers
      // Fast 150ms visual transition without blocking navigation
      document.body.classList.add('page-exiting');
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageTransitions);
  } else {
    initPageTransitions();
  }

})(window);
