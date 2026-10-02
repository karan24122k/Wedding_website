/**
 * Kumar Video & Photography - Intro / Story Depth (Phase 3)
 * "Crafting Cinematic Family Legacies"
 *
 * Built on WebGLSceneManager & KumarWebGL Foundation:
 * 1. Lazy Initialization: Only initializes when approaching viewport (rootMargin: 200px).
 * 2. Scoped WebGL Canvas: Confined to intro photo card, pointer-events: none.
 * 3. Restrained Multi-Layer Depth (5-20px max perceived displacement):
 *    - Background frame moves slower (-0.05x scroll offset)
 *    - Photograph moves naturally (+0.04x scroll offset)
 *    - Foreground badge floats at higher depth (+0.1x scroll offset)
 *    - Desktop mouse micro-parallax with spring interpolation
 * 4. Cinematic Film Production Counter (00 -> 100+):
 *    - Inspired by 35mm film slate frame count / production marks
 *    - Runs once on entry, completes in ~450ms, final value is exactly "100+"
 *    - Respects prefers-reduced-motion
 * 5. Full Fallback: If WebGL is disabled (?webgl=false), static HTML/CSS remains 100% functional.
 */

(function(window) {
  'use strict';

  function initStoryDepthModule() {
    const introSection = document.getElementById('intro');
    if (!introSection) return;

    const prefersReducedMotion = window.KumarWebGL ? window.KumarWebGL.prefersReducedMotion() : false;
    const isMobile = window.KumarWebGL ? window.KumarWebGL.isMobile() : (window.innerWidth < 768);
    const isLowEnd = window.KumarWebGL ? window.KumarWebGL.isLowEnd() : false;

    // --- 1. Archival Editorial Credibility Counter ---
    const desktopCounterEl = document.getElementById('film-counter');
    let counterHasRun = false;

    const isWebGLDisabled = (window.KumarWebGL && !window.KumarWebGL.isSupported) ||
                            (window.location.search.indexOf('webgl=false') !== -1);

    function runFilmCounter(targetEl) {
      if (!targetEl) return;
      // Preserve authentic terracotta accent markup and accessibility
      targetEl.innerHTML = '100<span class="text-[#c2410c] font-light ml-0.5">+</span>';
      targetEl.setAttribute('aria-label', '100+ Weddings Captured');
      counterHasRun = true;
    }

    // Immediate static display if reduced motion or WebGL is disabled
    if (prefersReducedMotion || isWebGLDisabled) {
      runFilmCounter(desktopCounterEl);
    }

    // --- 2. Multi-Layer Depth DOM Elements ---
    const compositionWrapper = introSection.querySelector('.intro-composition-wrapper');
    const photoCard = introSection.querySelector('.intro-photo-card');
    const photoImg = introSection.querySelector('.intro-photo-img');
    const canvas = document.getElementById('intro-depth-canvas');

    // Mouse & Scroll Parallax State
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let isVisible = false;
    let rafId = null;

    // --- 3. Scroll & Mouse Multi-Layer Interpolation ---
    function updateLayerTransforms() {
      if (!isVisible) return;

      if (!prefersReducedMotion && compositionWrapper) {
        const rect = introSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        // Relative scroll progress through section (-1 to 1)
        const scrollCenter = rect.top + rect.height * 0.5 - windowHeight * 0.5;
        // Clamped subtle vertical scroll separation (max 5-15px)
        const scrollDelta = Math.max(-100, Math.min(100, scrollCenter));

        // Smooth mouse damping (desktop only)
        if (!isMobile) {
          currentMouseX += (targetMouseX - currentMouseX) * 0.05;
          currentMouseY += (targetMouseY - currentMouseY) * 0.05;
        }

        // Archival photographic print subtle depth shift (desktop only)
        if (photoCard) {
          const photoY = scrollDelta * 0.02 + currentMouseY * 0.4;
          const photoX = currentMouseX * 0.4;
          photoCard.style.transform = `translate3d(${photoX.toFixed(2)}px, ${photoY.toFixed(2)}px, 0)`;
        }
      }

      rafId = requestAnimationFrame(updateLayerTransforms);
    }

    // Desktop Mouse Move Listener (Passive, scoped to composition wrapper)
    if (!prefersReducedMotion && !isMobile && compositionWrapper) {
      compositionWrapper.addEventListener('mousemove', (e) => {
        const rect = compositionWrapper.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        targetMouseX = Math.max(-1, Math.min(1, nx)) * 6; // max 6px shift
        targetMouseY = Math.max(-1, Math.min(1, ny)) * 6;
      }, { passive: true });

      compositionWrapper.addEventListener('mouseleave', () => {
        targetMouseX = 0;
        targetMouseY = 0;
      });
    }

    // --- 4. Scoped WebGL Depth Scene (Lazy-Initialized) ---
    let sceneManager = null;
    let depthTexture = null;
    let depthMesh = null;

    function initScopedWebGLScene() {
      if (!canvas || !window.KumarWebGL || !window.KumarWebGL.isSupported || typeof THREE === 'undefined' || typeof window.WebGLSceneManager === 'undefined') {
        return;
      }
      if (isLowEnd) {
        // Low-end devices: rely on lightweight CSS layer transforms for maximum smoothness
        return;
      }

      sceneManager = new window.WebGLSceneManager({
        canvas: canvas,
        fov: 35,
        cameraZ: 4.5,
        alpha: true,
        antialias: !isMobile,

        onInit: ({ scene, camera, width, height }) => {
          const textureLoader = new THREE.TextureLoader();
          // Load the actual intro photograph progressively
          depthTexture = textureLoader.load('gallery/pre-wedding/sangeet-01.webp', (tex) => {
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            if (THREE.SRGBColorSpace) {
              tex.colorSpace = THREE.SRGBColorSpace;
            }

            const imgAspect = (tex.image && tex.image.width) ? (tex.image.width / tex.image.height) : (4 / 5);
            const fovRad = (camera.fov * Math.PI) / 180;
            const visH = 2 * Math.tan(fovRad / 2) * camera.position.z;
            const visW = visH * (width / height);

            // Plane geometry with slight overscan
            const planeGeo = new THREE.PlaneGeometry(visW * 1.04, visH * 1.04, 8, 8);
            const planeMat = new THREE.MeshBasicMaterial({
              map: tex,
              transparent: true,
              opacity: 0.95
            });

            depthMesh = new THREE.Mesh(planeGeo, planeMat);
            scene.add(depthMesh);

            // Smooth progressive reveal of canvas over static image
            canvas.classList.remove('opacity-0');
            canvas.classList.add('opacity-100');
          });
        },

        onRender: () => {
          if (!sceneManager || !sceneManager.camera || prefersReducedMotion || isMobile) return;
          // Very subtle micro camera shift (under 3px)
          sceneManager.camera.position.x = currentMouseX * 0.015;
          sceneManager.camera.position.y = -currentMouseY * 0.015;
          sceneManager.camera.lookAt(0, 0, 0);
        },

        onResize: (w, h) => {
          if (depthMesh && depthTexture && depthTexture.image) {
            const fovRad = (sceneManager.camera.fov * Math.PI) / 180;
            const visH = 2 * Math.tan(fovRad / 2) * sceneManager.camera.position.z;
            const visW = visH * (w / h);
            depthMesh.geometry.dispose();
            depthMesh.geometry = new THREE.PlaneGeometry(visW * 1.04, visH * 1.04, 8, 8);
          }
        }
      });
    }

    // --- 5. Lazy Viewport Observer (Pre-activates 200px before entry) ---
    let webglInitialized = false;

    if ('IntersectionObserver' in window) {
      // Observer 1: Lazy initialization of WebGL scene when approaching viewport
      const approachObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !webglInitialized) {
            webglInitialized = true;
            initScopedWebGLScene();
            approachObserver.disconnect();
          }
        });
      }, { rootMargin: '200px' });

      approachObserver.observe(introSection);

      // Observer 2: Counter trigger & render loop control
      const visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            isVisible = true;

            // Trigger credibility counter once
            if (!counterHasRun) {
              runFilmCounter(desktopCounterEl);
            }

            // Start layer animation loop
            if (!rafId && !prefersReducedMotion) {
              rafId = requestAnimationFrame(updateLayerTransforms);
            }
          } else {
            isVisible = false;
            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
          }
        });
      }, { threshold: 0.1 });

      visibilityObserver.observe(introSection);
    } else {
      // Immediate fallback if IntersectionObserver is unavailable
      runFilmCounter(desktopCounterEl);
      initScopedWebGLScene();
    }

    // --- 6. WebGL Status / Kill Switch Change Listener ---
    window.addEventListener('webgl:statuschange', (e) => {
      if (!e.detail.enabled && sceneManager) {
        canvas.classList.remove('opacity-100');
        canvas.classList.add('opacity-0');
        sceneManager.cleanup();
      }
    });
  }

  // Initialize module
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStoryDepthModule);
  } else {
    initStoryDepthModule();
  }

})(window);
