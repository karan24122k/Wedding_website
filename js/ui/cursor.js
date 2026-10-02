/**
 * Kumar Video & Photography - Minimal Editorial Custom Cursor (Phase 7)
 *
 * Core Architecture & Constraints:
 * 1. Progressive Enhancement: Desktop pointer devices only.
 * 2. Disabled automatically on:
 *    - Touch devices ('ontouchstart', navigator.maxTouchPoints > 0)
 *    - Coarse pointers (matchMedia '(pointer: coarse)')
 *    - Small/mobile viewports (<1024px)
 *    - prefers-reduced-motion: reduce
 * 3. Native Cursor Safety: Native browser cursor is preserved until custom cursor is confirmed ready.
 * 4. Zero Stationary Polling: No continuous animation loop while the pointer is at rest.
 *    - Updates batched via pointermove + requestAnimationFrame.
 *    - rAF terminates immediately once motion stops.
 * 5. Hardware-Accelerated: Transform3d positioning, no layout recalculations.
 * 6. Non-Blocking & Accessible: pointer-events: none, aria-hidden="true".
 *    - Keyboard navigation and visible focus rings (:focus-visible) remain 100% untouched.
 */

(function(window) {
  'use strict';

  function initCustomCursor() {
    // 1. Strict Environment & Accessibility Checks
    const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallScreen = window.innerWidth < 1024;

    if (isTouch || isCoarse || isReducedMotion || isSmallScreen) {
      return; // Touch and reduced-motion retain 100% native cursor
    }

    // 2. Build Minimal DOM Elements
    const cursorContainer = document.createElement('div');
    cursorContainer.id = 'custom-cursor';
    cursorContainer.className = 'custom-cursor pointer-events-none fixed top-0 left-0 z-[9999] opacity-0 transition-opacity duration-300';
    cursorContainer.setAttribute('aria-hidden', 'true');

    const dot = document.createElement('div');
    dot.className = 'cursor-dot';

    const ring = document.createElement('div');
    ring.className = 'cursor-ring';

    const label = document.createElement('span');
    label.className = 'cursor-label';

    ring.appendChild(label);
    cursorContainer.appendChild(dot);
    cursorContainer.appendChild(ring);
    document.body.appendChild(cursorContainer);

    // Coordinate state
    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let isMoving = false;
    let rafId = null;
    let isVisible = false;

    // Smooth lerp loop (active ONLY during motion)
    function updatePosition() {
      const dx = targetX - ringX;
      const dy = targetY - ringY;

      ringX += dx * 0.22;
      ringY += dy * 0.22;

      // Transform3d for zero-layout GPU compositing
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      // Terminate loop once close enough (sub-pixel settling)
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        rafId = requestAnimationFrame(updatePosition);
      } else {
        isMoving = false;
        rafId = null;
      }
    }

    function scheduleUpdate() {
      if (!isMoving) {
        isMoving = true;
        rafId = requestAnimationFrame(updatePosition);
      }
    }

    // 3. Pointermove Event
    document.addEventListener('pointermove', (e) => {
      // Ignore simulated touch/pen mouse events
      if (e.pointerType === 'touch' || e.pointerType === 'pen') return;

      targetX = e.clientX;
      targetY = e.clientY;

      if (!isVisible) {
        isVisible = true;
        cursorContainer.classList.remove('opacity-0');
        cursorContainer.classList.add('opacity-100');
        document.documentElement.classList.add('has-custom-cursor');
        ringX = targetX;
        ringY = targetY;
      }

      scheduleUpdate();
    }, { passive: true });

    // 4. Mouse Leave / Enter Window
    document.addEventListener('mouseleave', () => {
      cursorContainer.classList.remove('opacity-100');
      cursorContainer.classList.add('opacity-0');
      isVisible = false;
    });

    document.addEventListener('mouseenter', () => {
      cursorContainer.classList.remove('opacity-0');
      cursorContainer.classList.add('opacity-100');
      isVisible = true;
    });

    // 5. Contextual State Handling (Delegated)
    document.addEventListener('mouseover', (e) => {
      const target = e.target;
      if (!target) return;

      // Video elements or video overlays
      const isVideo = target.closest('video, .video-container, .play-overlay, #featured-wedding-reel');
      if (isVideo) {
        setContext('video', 'PLAY');
        return;
      }

      // Photography items / story stage / gallery cards
      const isImage = target.closest('.gallery-item, #story-visual-stage, .story-photo-layer, #story-stage-container img');
      if (isImage) {
        setContext('image', 'VIEW');
        return;
      }

      // Interactive links and buttons
      const isInteractive = target.closest('a, button, .category-tab, .story-tab-btn, .orient-btn, input, select, textarea');
      if (isInteractive) {
        setContext('link', '');
        return;
      }

      // Default state
      resetContext();
    }, { passive: true });

    function setContext(type, text) {
      cursorContainer.classList.remove('cursor-state-image', 'cursor-state-video', 'cursor-state-link');
      cursorContainer.classList.add(`cursor-state-${type}`);

      if (text) {
        label.textContent = text;
        label.style.display = 'inline-block';
      } else {
        label.textContent = '';
        label.style.display = 'none';
      }
    }

    function resetContext() {
      cursorContainer.classList.remove('cursor-state-image', 'cursor-state-video', 'cursor-state-link');
      label.textContent = '';
      label.style.display = 'none';
    }

    // 6. Click Feedback
    document.addEventListener('mousedown', () => {
      cursorContainer.classList.add('cursor-active');
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      cursorContainer.classList.remove('cursor-active');
    }, { passive: true });

    // 7. Cleanup & Viewport Resize
    window.addEventListener('resize', () => {
      if (window.innerWidth < 1024) {
        cursorContainer.classList.remove('opacity-100');
        cursorContainer.classList.add('opacity-0');
        document.documentElement.classList.remove('has-custom-cursor');
      }
    }, { passive: true });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomCursor);
  } else {
    initCustomCursor();
  }

})(window);
