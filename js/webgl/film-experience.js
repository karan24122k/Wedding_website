/**
 * Kumar Video & Photography - Cinematography Experience (Phase 5)
 *
 * Core Architecture & Strict Video Priority:
 * 1. The Video is the Product: Native HTML5 <video> elements remain the 100% source of truth.
 * 2. Zero Video Frames in WebGL: Video frames are NEVER copied, decoded, or rendered into WebGL textures.
 *    - Browser video compositor handles video playback with full hardware acceleration.
 * 3. Restrained Ambient Framing: Three.js renders only a subtle ambient bias glow and micro-grain
 *    in the surrounding frame perimeter behind the video container.
 * 4. Orientation Switcher Resilience: Seamlessly adapts between WIDE (16:9) and REEL (9:16)
 *    without reloading video or resetting playback state.
 * 5. Strictly Bounded Memory:
 *    - 0 video textures in GPU memory
 *    - 1 quad plane geometry
 *    - 1 custom shader material
 * 6. Lazy Viewport Initialization:
 *    - Uses IntersectionObserver (250px rootMargin)
 *    - Render loop is paused when section leaves viewport, minimizing unnecessary CPU/GPU usage.
 * 7. Fallback & Accessibility:
 *    - Canvas has pointer-events: none and aria-hidden="true".
 *    - Disabled on mobile/touch, low-end devices, and prefers-reduced-motion.
 *    - ?webgl=false leaves pure, beautiful HTML/CSS video.
 */

(function(window) {
  'use strict';

  function initFilmExperience() {
    // 1. Capability & Device Checks
    if (!window.KumarWebGL || !window.KumarWebGL.isSupported || typeof THREE === 'undefined' || typeof window.WebGLSceneManager === 'undefined') {
      return;
    }
    if (window.KumarWebGL.isMobile() || window.KumarWebGL.isTouch() || window.KumarWebGL.prefersReducedMotion() || window.KumarWebGL.isLowEnd()) {
      return; // Mobile and low-end devices use native HTML/CSS
    }

    // Identify video containers across films.html and index.html
    const containers = [];
    const featuredCard = document.querySelector('#featured-films .max-w-4xl');
    if (featuredCard) {
      const vid = featuredCard.querySelector('video');
      if (vid) containers.push({ card: featuredCard, video: vid });
    }

    const filmCards = document.querySelectorAll('.video-card');
    filmCards.forEach(card => {
      const vid = card.querySelector('video');
      const vc = card.querySelector('.video-container') || card;
      if (vid) containers.push({ card: vc, video: vid, outerCard: card });
    });

    if (containers.length === 0) return;

    // Enhance each container with subtle ambient framing
    containers.forEach(({ card, video, outerCard }) => {
      enhanceVideoContainer(card, video, outerCard);
    });
  }

  function enhanceVideoContainer(container, video, outerCard) {
    const parent = outerCard || container;
    parent.classList.add('cinematic-frame');

    // Create ambient canvas placed behind the video container
    const canvas = document.createElement('canvas');
    canvas.className = 'film-ambient-canvas absolute -inset-6 w-[calc(100%+3rem)] h-[calc(100%+3rem)] pointer-events-none -z-10 opacity-0 transition-opacity duration-700 rounded-3xl';
    canvas.setAttribute('aria-hidden', 'true');

    // Ensure parent has relative positioning
    const computedPos = window.getComputedStyle(parent).position;
    if (computedPos === 'static') {
      parent.style.position = 'relative';
    }
    parent.insertBefore(canvas, parent.firstChild);

    // Uniform state
    let playIntensity = 0.0;
    let targetPlayIntensity = 0.0;
    let sceneManager = null;
    let material = null;
    let geometry = null;
    let mesh = null;

    // Passive listeners on native video
    video.addEventListener('play', () => { targetPlayIntensity = 1.0; }, { passive: true });
    video.addEventListener('pause', () => { targetPlayIntensity = 0.0; }, { passive: true });
    video.addEventListener('ended', () => { targetPlayIntensity = 0.0; }, { passive: true });

    // Custom Ambient Shader (0 textures, pure GLSL procedural bias glow + micro-grain)
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision mediump float;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uPlayIntensity;
      varying vec2 vUv;

      // Ultra-light pseudo-random hash for barely perceptible micro-grain
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 uv = vUv;
        vec2 centered = uv - 0.5;
        float dist = length(centered);

        // Warm champagne and amber theater projection bias lighting
        vec3 amberGlow = vec3(0.76, 0.32, 0.06);
        vec3 goldLight = vec3(0.92, 0.68, 0.38);

        // Very slow, soft ambient pulse (period ~8s)
        float pulse = 0.03 * sin(uTime * 0.75);

        // Soft radial falloff behind video frame
        float biasLight = smoothstep(0.75, 0.2, dist) * (0.10 + 0.06 * uPlayIntensity + pulse);

        // Barely perceptible micro-grain (amplitude 0.02, slow non-flickering drift)
        float grain = (hash(uv * 350.0 + fract(uTime * 0.12)) - 0.5) * 0.02;

        vec3 color = mix(amberGlow, goldLight, 0.45 + 0.15 * sin(uTime * 0.4));
        float alpha = clamp(biasLight + grain, 0.0, 0.22);

        gl_FragColor = vec4(color, alpha);
      }
    `;

    // Lazy initialization using IntersectionObserver (250px rootMargin)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          parent.classList.add('in-view');
          if (!sceneManager) {
            initScene();
          } else {
            sceneManager.start();
          }
          canvas.classList.remove('opacity-0');
          canvas.classList.add('opacity-100');
        } else {
          parent.classList.remove('in-view');
          if (sceneManager) {
            sceneManager.pause();
          }
          canvas.classList.remove('opacity-100');
          canvas.classList.add('opacity-0');
        }
      });
    }, { rootMargin: '250px 0px 250px 0px', threshold: 0.05 });

    observer.observe(parent);

    function initScene() {
      material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(canvas.clientWidth || 300, canvas.clientHeight || 200) },
          uPlayIntensity: { value: 0 }
        },
        transparent: true,
        depthWrite: false
      });

      geometry = new THREE.PlaneGeometry(2, 2);
      mesh = new THREE.Mesh(geometry, material);

      sceneManager = new window.WebGLSceneManager({
        canvas: canvas,
        alpha: true,
        antialias: false, // Ambient halo doesn't require multisampling
        onInit: ({ scene }) => {
          scene.add(mesh);
        },
        onRender: (timestamp) => {
          if (!material) return;
          // Smoothly lerp play intensity (theater bias lighting response)
          playIntensity += (targetPlayIntensity - playIntensity) * 0.05;
          material.uniforms.uTime.value = timestamp * 0.001;
          material.uniforms.uPlayIntensity.value = playIntensity;
        },
        onResize: (w, h) => {
          if (material && material.uniforms && material.uniforms.uResolution) {
            material.uniforms.uResolution.value.set(w, h);
          }
        }
      });

      sceneManager.start();
    }

    // Orientation Switcher & Container Resize Observer
    // Detects WIDE 16:9 vs REEL 9:16 layout shifts seamlessly
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (sceneManager && sceneManager.handleResize) {
          sceneManager.handleResize();
        }
      });
      resizeObserver.observe(container);
    }

    // WebGL Kill Switch Listener
    window.addEventListener('webgl:statuschange', (e) => {
      if (!e.detail.enabled && sceneManager) {
        sceneManager.pause();
        sceneManager.cleanup();
        canvas.classList.add('hidden');
      }
    });

    // Cleanup on beforeunload
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      if (sceneManager) {
        sceneManager.cleanup();
      }
      if (geometry) geometry.dispose();
      if (material) material.dispose();
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilmExperience);
  } else {
    initFilmExperience();
  }

})(window);
