/**
 * Kumar Video & Photography - Editorial WebGL Gallery (Phase 4)
 *
 * Core Architecture & Strict Memory Policy:
 * 1. Default Representation: HTML <img> elements are the primary DOM content and fallback.
 * 2. Strict Bounded GPU Memory: Maximum 1 concurrent texture at any time.
 *    - Textures exist ONLY while hovering an active card.
 *    - Texture is disposed immediately on mouseleave.
 * 3. Restrained Hover Effect: Max 1-3% gentle scale & subtle spatial shift.
 *    - Faces, rituals, expressions, and clothing remain pristine and visually undistorted.
 *    - Zero liquid warping, zero distortion shaders.
 * 4. Pointer Events: Overlay canvas has pointer-events: none; lightbox opens without interference.
 * 5. Lightbox Integrity: Uses 100% of the existing high-res accessible lightbox.
 * 6. Mobile & Low-End Optimization:
 *    - Disabled on mobile, touch devices, low-end devices, and reduced-motion mode.
 *    - Touch interactions remain completely native HTML/CSS.
 */

(function(window) {
  'use strict';

  function initEditorialGallery() {
    // 1. Guard conditions: check WebGL capability, mobile, touch, and reduced motion
    if (!window.KumarWebGL || !window.KumarWebGL.isSupported || typeof THREE === 'undefined' || typeof window.WebGLSceneManager === 'undefined') {
      return;
    }
    if (window.KumarWebGL.isMobile() || window.KumarWebGL.isTouch() || window.KumarWebGL.prefersReducedMotion() || window.KumarWebGL.isLowEnd()) {
      return; // Mobile and reduced-motion use pure, pristine HTML/CSS
    }

    // 2. Single Shared Overlay Canvas (Bounded single-instance resource)
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'gallery-hover-canvas';
    overlayCanvas.className = 'absolute inset-0 w-full h-full pointer-events-none opacity-0 transition-opacity duration-300 z-10';
    overlayCanvas.setAttribute('aria-hidden', 'true');

    let currentCard = null;
    let sceneManager = null;
    let activeTexture = null;
    let activeMesh = null;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    // Dispose active texture and cleanup WebGL scene
    function releaseCurrentTexture() {
      if (sceneManager) {
        sceneManager.pause();
        sceneManager.cleanup();
        sceneManager = null;
      }
      if (activeTexture) {
        activeTexture.dispose();
        activeTexture = null;
      }
      if (activeMesh) {
        if (activeMesh.geometry) activeMesh.geometry.dispose();
        if (activeMesh.material) activeMesh.material.dispose();
        activeMesh = null;
      }
      if (overlayCanvas.parentElement) {
        overlayCanvas.classList.remove('opacity-100');
        overlayCanvas.classList.add('opacity-0');
        overlayCanvas.parentElement.removeChild(overlayCanvas);
      }
      currentCard = null;
      targetX = 0;
      targetY = 0;
      currentX = 0;
      currentY = 0;
    }

    // Bind hover effect to a gallery item
    function bindCardHover(card) {
      if (card === currentCard) return;

      // Release any previous card's texture first (guarantees max 1 active texture)
      releaseCurrentTexture();

      const img = card.querySelector('img');
      const imgContainer = img ? img.parentElement : card;
      if (!img || !img.src) return;

      currentCard = card;
      imgContainer.style.position = 'relative';
      imgContainer.appendChild(overlayCanvas);

      // Measure card dimensions
      const rect = imgContainer.getBoundingClientRect();
      const cardWidth = rect.width;
      const cardHeight = rect.height;

      // Initialize single-scene manager for this hovered card
      sceneManager = new window.WebGLSceneManager({
        canvas: overlayCanvas,
        fov: 35,
        cameraZ: 4.5,
        alpha: true,
        antialias: true,

        onInit: ({ scene, camera }) => {
          const textureLoader = new THREE.TextureLoader();
          // Load texture on-demand for this single card only
          const currentBindingCard = card;
          activeTexture = textureLoader.load(img.src, (tex) => {
            // If the user already moved mouse off the card before texture loaded
            if (currentCard !== currentBindingCard || !sceneManager || !overlayCanvas.parentElement) {
              tex.dispose();
              return;
            }

            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            if (THREE.SRGBColorSpace) {
              tex.colorSpace = THREE.SRGBColorSpace;
            }

            const fovRad = (camera.fov * Math.PI) / 180;
            const visH = 2 * Math.tan(fovRad / 2) * camera.position.z;
            const visW = visH * (cardWidth / cardHeight);

            // Plane geometry with restrained 1.03 scale (max 3% zoom)
            const geometry = new THREE.PlaneGeometry(visW * 1.03, visH * 1.03, 8, 8);
            const material = new THREE.MeshBasicMaterial({
              map: tex,
              transparent: true,
              opacity: 0.98
            });

            activeMesh = new THREE.Mesh(geometry, material);
            scene.add(activeMesh);

            // Fade in overlay smoothly
            overlayCanvas.classList.remove('opacity-0');
            overlayCanvas.classList.add('opacity-100');
            if (sceneManager) {
              sceneManager.start();
            }
          });
        },

        onRender: () => {
          if (!sceneManager || !sceneManager.camera || !activeMesh) return;
          // Smooth micro-lens parallax interpolation (damped, max 1-3% shift)
          currentX += (targetX - currentX) * 0.06;
          currentY += (targetY - currentY) * 0.06;

          // Subtle spatial shift without any face or image distortion
          sceneManager.camera.position.x = currentX * 0.02;
          sceneManager.camera.position.y = -currentY * 0.02;
          sceneManager.camera.lookAt(0, 0, 0);
        }
      });
    }

    // Delegated Event Listeners for clean lifecycle across filter switches
    document.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.gallery-item');
      if (card && card !== currentCard) {
        bindCardHover(card);
      }
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
      if (!currentCard) return;
      const rect = currentCard.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) {
        releaseCurrentTexture();
        return;
      }
      // Normalized coordinates from card center [-1, 1]
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetX = Math.max(-1, Math.min(1, nx)) * 3; // max 3px perceived shift
      targetY = Math.max(-1, Math.min(1, ny)) * 3;
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      if (currentCard && !currentCard.contains(e.relatedTarget)) {
        releaseCurrentTexture();
      }
    }, { passive: true });

    // Release immediately when lightbox opens or on window scroll
    window.addEventListener('scroll', () => {
      if (currentCard) releaseCurrentTexture();
    }, { passive: true });

    // WebGL Kill Switch / Status Change Listener
    window.addEventListener('webgl:statuschange', (e) => {
      if (!e.detail.enabled) {
        releaseCurrentTexture();
      }
    });

    // Cleanup on beforeunload
    window.addEventListener('beforeunload', () => {
      releaseCurrentTexture();
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditorialGallery);
  } else {
    initEditorialGallery();
  }

})(window);
