/**
 * Kumar Video & Photography - Signature WebGL Hero Scene (Phase 2)
 *
 * Built on WebGLSceneManager & KumarWebGL Foundation:
 * 1. Progressive Enhancement: Static CSS hero displays immediately; WebGL enhances asynchronously.
 * 2. High-Res Image Plane with Cover Fit & Overscan: Prevents edge detachment during parallax.
 * 3. Damped Mouse Parallax (5-15px perceived movement, desktop only).
 * 4. Atmospheric Particles: Wedding confetti/dust (Desktop: 75, Mobile: 24, Low-End: 0, Reduced-Motion: 0).
 * 5. Subtle Scroll Reaction: Slight vertical lag & gentle atmospheric fade.
 * 6. Full Fallback & Clean Resource Disposal.
 */

(function(window) {
  'use strict';

  function initHeroScene() {
    // 1. Check WebGL support and feature flag from Phase 1 foundation
    if (!window.KumarWebGL || !window.KumarWebGL.isSupported || typeof THREE === 'undefined' || typeof window.WebGLSceneManager === 'undefined') {
      return;
    }

    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const heroSection = canvas.closest('section');
    if (!heroSection) return;

    const isMobile = window.KumarWebGL.isMobile();
    const isLowEnd = window.KumarWebGL.isLowEnd();
    const prefersReducedMotion = window.KumarWebGL.prefersReducedMotion();

    // References for WebGL objects
    let sceneManager = null;
    let imageMesh = null;
    let heroTexture = null;
    let particleSystem = null;
    let particleTexture = null;

    // Parallax state
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;
    let scrollY = 0;
    const maxParallax = isMobile ? 0 : 0.035; // 4-7px subtle perceived displacement on desktop

    // Calculate plane scale to cover viewport without distortion or exposed borders
    function calculateCoverScale(camera, width, height, imageAspect) {
      const fovRad = (camera.fov * Math.PI) / 180;
      const visibleHeight = 2 * Math.tan(fovRad / 2) * camera.position.z;
      const visibleWidth = visibleHeight * (width / height);
      const screenAspect = width / height;

      // 1.04 overscan ensures 4-7px parallax never detaches while preserving portrait framing
      const overscan = 1.04;
      let planeW, planeH;

      if (screenAspect > imageAspect) {
        planeW = visibleWidth * overscan;
        planeH = (visibleWidth / imageAspect) * overscan;
      } else {
        planeH = visibleHeight * overscan;
        planeW = (visibleHeight * imageAspect) * overscan;
      }
      return { width: planeW, height: planeH };
    }

    // 2. Initialize WebGLSceneManager
    sceneManager = new window.WebGLSceneManager({
      canvas: canvas,
      fov: 45,
      cameraZ: 5,
      alpha: true,
      antialias: !isMobile,

      onInit: ({ scene, camera, width, height }) => {
        // Load the actual existing hero photograph
        const textureLoader = new THREE.TextureLoader();
        heroTexture = textureLoader.load('gallery/wedding/bridal-01.webp', (texture) => {
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          if (THREE.SRGBColorSpace) {
            texture.colorSpace = THREE.SRGBColorSpace;
          }

          const imageAspect = (texture.image && texture.image.width) ?
            (texture.image.width / texture.image.height) : (4 / 5);

          const dims = calculateCoverScale(camera, width, height, imageAspect);
          const geometry = new THREE.PlaneGeometry(dims.width, dims.height, 16, 16);

          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.98
          });

          imageMesh = new THREE.Mesh(geometry, material);
          imageMesh.position.set(0, 0, 0);
          scene.add(imageMesh);

          // Atmospheric Confetti & Light Particles (Restrained: 30 on desktop, 0 on mobile)
          if (!prefersReducedMotion && !isLowEnd) {
            const particleCount = isMobile ? 0 : 30;
            if (particleCount > 0) {
              const particleGeo = new THREE.BufferGeometry();
              const positions = new Float32Array(particleCount * 3);
              const velocities = new Float32Array(particleCount * 3);

              for (let i = 0; i < particleCount; i++) {
                // Keep particles strictly toward the outer edges so they never compete with the bride
                const side = Math.random() > 0.5 ? 1 : -1;
                positions[i * 3] = side * (1.8 + Math.random() * 3.5);
                positions[i * 3 + 1] = (Math.random() - 0.5) * 6.5;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5 + 0.5;

                velocities[i * 3] = (Math.random() - 0.5) * 0.0018;
                velocities[i * 3 + 1] = 0.0012 + Math.random() * 0.0022; // gentle upward drift
                velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
              }

              particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

              const pCanvas = document.createElement('canvas');
              pCanvas.width = 32;
              pCanvas.height = 32;
              const pCtx = pCanvas.getContext('2d');
              const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
              grad.addColorStop(0, 'rgba(254, 240, 138, 0.75)'); // Warm champagne
              grad.addColorStop(0.4, 'rgba(245, 158, 11, 0.35)'); // Amber dust
              grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
              pCtx.fillStyle = grad;
              pCtx.beginPath();
              pCtx.arc(16, 16, 16, 0, Math.PI * 2);
              pCtx.fill();

              particleTexture = new THREE.CanvasTexture(pCanvas);

              const pMaterial = new THREE.PointsMaterial({
                size: isMobile ? 0.09 : 0.13,
                map: particleTexture,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false
              });

              particleSystem = new THREE.Points(particleGeo, pMaterial);
              particleSystem.userData = { velocities, count: particleCount };
              scene.add(particleSystem);
            }
          }

          // 3. Progressive enhancement: gently fade in the canvas over the static CSS image
          canvas.classList.remove('opacity-0');
          canvas.classList.add('opacity-100');
        });
      },

      onRender: (timestamp, delta) => {
        if (!sceneManager || !sceneManager.camera) return;

        // Smooth camera damping for mouse parallax (desktop only)
        if (!prefersReducedMotion && !isMobile) {
          currentParallaxX += (targetParallaxX - currentParallaxX) * 0.045;
          currentParallaxY += (targetParallaxY - currentParallaxY) * 0.045;

          // Subtle scroll reaction: slow vertical lag
          const scrollOffset = scrollY * 0.0008;

          sceneManager.camera.position.x = currentParallaxX;
          sceneManager.camera.position.y = currentParallaxY - scrollOffset;
          sceneManager.camera.lookAt(0, -scrollOffset * 0.5, 0);
        }

        // Animate atmospheric particles
        if (particleSystem && particleSystem.userData && !prefersReducedMotion) {
          const pos = particleSystem.geometry.attributes.position.array;
          const vel = particleSystem.userData.velocities;
          const count = particleSystem.userData.count;

          for (let i = 0; i < count; i++) {
            pos[i * 3 + 1] += vel[i * 3 + 1];
            pos[i * 3] += Math.sin(timestamp * 0.0008 + i) * 0.001;

            // Wrap particle when reaching top
            if (pos[i * 3 + 1] > 3.8) {
              pos[i * 3 + 1] = -3.8;
              pos[i * 3] = (Math.random() - 0.5) * 8.5;
            }
          }
          particleSystem.geometry.attributes.position.needsUpdate = true;

          // Fade particles slightly as user scrolls down
          if (scrollY > 0) {
            const fade = Math.max(0, 1 - (scrollY / (heroSection.clientHeight || 800)));
            particleSystem.material.opacity = 0.6 * fade;
          }
        }
      },

      onResize: (width, height, aspect) => {
        if (imageMesh && heroTexture && heroTexture.image) {
          const imgAspect = heroTexture.image.width / heroTexture.image.height;
          const dims = calculateCoverScale(sceneManager.camera, width, height, imgAspect);
          imageMesh.geometry.dispose();
          imageMesh.geometry = new THREE.PlaneGeometry(dims.width, dims.height, 16, 16);
        }
      }
    });

    // 4. Mouse Move Event (Desktop only, passive)
    if (!prefersReducedMotion && !isMobile) {
      window.addEventListener('mousemove', (e) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -(e.clientY / window.innerHeight) * 2 + 1;
        targetParallaxX = nx * maxParallax;
        targetParallaxY = ny * maxParallax;
      }, { passive: true });
    }

    // 5. Scroll Event (Passive tracking)
    window.addEventListener('scroll', () => {
      scrollY = window.scrollY || window.pageYOffset;
    }, { passive: true });

    // 6. WebGL Disabled / Status Change Listener
    window.addEventListener('webgl:statuschange', (e) => {
      if (!e.detail.enabled && sceneManager) {
        canvas.classList.remove('opacity-100');
        canvas.classList.add('opacity-0');
        sceneManager.cleanup();
      }
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroScene);
  } else {
    initHeroScene();
  }

})(window);
