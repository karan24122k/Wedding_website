/**
 * Kumar Video & Photography - "A Wedding Story You Can Step Into" (P1.3)
 *
 * Core Architecture & Constraints:
 * 1. Semantic Source of Truth: All chapter titles, text, couples, and photographs are native HTML5.
 * 2. Strict GPU Resource Budget: Maximum 2 concurrent textures in GPU memory (current + next during transition; 1 when settled).
 * 3. Photographic Integrity: Zero facial warping, zero liquid distortion, zero aggressive perspective deformation.
 * 4. Adaptive Photographic Matting: Seamlessly supports landscape (3:2, 16:9) and vertical portrait (2:3) with object-contain.
 * 5. Roman Numeral Editorial Navigation: Understated I, II, III, IV markers with full ARIA tablist keyboard navigation.
 * 6. Lazy Initialization: IntersectionObserver (250px rootMargin) defers loading and pauses loop when offscreen.
 * 7. Natural Page Scrolling: No scroll-jacking, no fixed tunnels.
 * 8. Fallback & Mobile: Pure HTML/CSS on mobile, reduced-motion, low-end devices, or ?webgl=false.
 */

(function(window) {
  'use strict';

  const STORY_CHAPTERS = [
    {
      id: 0,
      roman: "I",
      title: "The Prelude & Getting Ready",
      subtitle: "The Prelude",
      location: "The Royal Suite, The Leela Palace",
      caption: "Bridal preparations and heirloom jewellery at The Leela Palace",
      src: "gallery/wedding/bridal-01.webp",
      aspect: 1920 / 1280
    },
    {
      id: 1,
      roman: "II",
      title: "The Sacred Pheras & Vows",
      subtitle: "Sacred Pheras",
      location: "Grand Mandap Courtyard, Bengaluru",
      caption: "Aditya and Anjali taking sacred pheras around the holy fire",
      src: "gallery/wedding/vows-01.webp",
      aspect: 1920 / 1045
    },
    {
      id: 2,
      roman: "III",
      title: "Candid Vidaai & Raw Emotion",
      subtitle: "Raw Emotion",
      location: "Palace Portico, Evening",
      caption: "Emotional farewell tears and embraces during the vidaai ceremony",
      src: "gallery/wedding/moments-01.webp",
      aspect: 1381 / 1920
    },
    {
      id: 3,
      roman: "IV",
      title: "The Grand Reception Celebration",
      subtitle: "Grand Gala",
      location: "The Grand Ballroom",
      caption: "Royally lit reception celebration and evening revelry",
      src: "gallery/wedding/reception-01.webp",
      aspect: 1920 / 1042
    }
  ];

  function initWeddingStory() {
    const storySection = document.getElementById('wedding-story');
    if (!storySection) return;

    let currentIndex = 0;
    let isTransitioning = false;

    // DOM Elements
    const canvas = document.getElementById('wedding-story-canvas');
    const visualStage = document.getElementById('story-visual-stage');
    const tabButtons = document.querySelectorAll('.story-tab-btn');
    const prevBtn = document.getElementById('story-prev-btn');
    const nextBtn = document.getElementById('story-next-btn');
    const counterEl = document.getElementById('story-counter');
    const matNumeralEl = document.getElementById('story-mat-numeral');
    const htmlImages = document.querySelectorAll('.story-photo-layer');
    const articlePanes = document.querySelectorAll('.story-article-pane');

    // Lightbox DOM elements
    const lightbox = document.getElementById('lightbox');
    const lbImg = document.getElementById('lb-img');
    const lbTitle = document.getElementById('lb-title');
    const lbCaption = document.getElementById('lb-caption');
    const lbCounter = document.getElementById('lb-counter');
    const lbClose = document.getElementById('lb-close');
    const lbPrev = document.getElementById('lb-prev');
    const lbNext = document.getElementById('lb-next');

    // WebGL State (Bounded max 2 textures)
    let sceneManager = null;
    let crossfadeMaterial = null;
    let currentTexture = null;
    let nextTexture = null;
    let transitionStartTime = 0;
    const TRANSITION_DURATION = 550; // ms

    // Parallax tracking
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const isWebGLUsable = (
      window.KumarWebGL &&
      window.KumarWebGL.isSupported &&
      !window.KumarWebGL.isMobile() &&
      !window.KumarWebGL.isTouch() &&
      !window.KumarWebGL.prefersReducedMotion() &&
      !window.KumarWebGL.isLowEnd() &&
      (window.location.search.indexOf('webgl=false') === -1) &&
      typeof THREE !== 'undefined' &&
      typeof window.WebGLSceneManager !== 'undefined' &&
      canvas
    );

    // Update HTML/CSS states across tabs and articles
    function updateDOMState(newIndex) {
      currentIndex = newIndex;
      const chapter = STORY_CHAPTERS[newIndex];

      // Update Navigation Buttons (Understated Roman Numeral Styling)
      tabButtons.forEach((btn, idx) => {
        if (idx === newIndex) {
          btn.className = 'story-tab-btn active pb-2.5 text-xs sm:text-[13px] uppercase tracking-editorial transition border-b-2 border-[#c2410c] text-[#c2410c] font-medium shrink-0';
          btn.setAttribute('aria-selected', 'true');
          btn.setAttribute('tabindex', '0');
        } else {
          btn.className = 'story-tab-btn pb-2.5 text-xs sm:text-[13px] uppercase tracking-editorial transition border-b-2 border-transparent text-[#78716c] hover:text-[#1c1917] font-medium shrink-0';
          btn.setAttribute('aria-selected', 'false');
          btn.setAttribute('tabindex', '-1');
        }
      });

      // Update Article Text Panes
      articlePanes.forEach((pane, idx) => {
        if (idx === newIndex) {
          pane.classList.remove('hidden');
          pane.classList.add('block');
          pane.setAttribute('aria-hidden', 'false');
        } else {
          pane.classList.remove('block');
          pane.classList.add('hidden');
          pane.setAttribute('aria-hidden', 'true');
        }
      });

      // Update Fallback/Underlying HTML Images
      htmlImages.forEach((img, idx) => {
        if (idx === newIndex) {
          img.classList.remove('opacity-0');
          img.classList.add('opacity-100', 'active');
        } else {
          img.classList.remove('opacity-100', 'active');
          img.classList.add('opacity-0');
        }
      });

      // Update Archival Colophon Counter & Mat Numeral
      if (counterEl) {
        counterEl.textContent = `Plate ${chapter.roman} of IV`;
      }
      if (matNumeralEl) {
        matNumeralEl.textContent = chapter.roman;
      }
    }

    // Advance to specified chapter
    function goToChapter(targetIndex) {
      if (targetIndex === currentIndex && currentTexture) return;
      if (targetIndex < 0 || targetIndex >= STORY_CHAPTERS.length) return;

      updateDOMState(targetIndex);

      // If WebGL is active, execute smooth photographic crossfade with adaptive aspect ratio
      if (isWebGLUsable && sceneManager && crossfadeMaterial) {
        loadAndCrossfade(STORY_CHAPTERS[targetIndex].src, STORY_CHAPTERS[targetIndex].aspect);
      }
    }

    // WebGL Texture Management & Adaptive Photographic Crossfade
    function loadAndCrossfade(targetSrc, targetAspect) {
      const loader = new THREE.TextureLoader();
      isTransitioning = true;
      transitionStartTime = performance.now();

      loader.load(targetSrc, (loadedTex) => {
        loadedTex.minFilter = THREE.LinearFilter;
        loadedTex.magFilter = THREE.LinearFilter;
        if (THREE.SRGBColorSpace) {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
        }

        if (nextTexture) {
          nextTexture.dispose();
        }
        nextTexture = loadedTex;
        crossfadeMaterial.uniforms.uTexNext.value = nextTexture;
        crossfadeMaterial.uniforms.uAspectNext.value = targetAspect;
        crossfadeMaterial.uniforms.uHasNext.value = 1.0;
        crossfadeMaterial.uniforms.uProgress.value = 0.0;
      });
    }

    // WebGL Scene Initialization (IntersectionObserver triggered)
    function initWebGL() {
      if (!isWebGLUsable || sceneManager) return;

      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;

      const fragmentShader = `
        precision mediump float;
        uniform sampler2D uTexCurrent;
        uniform sampler2D uTexNext;
        uniform float uProgress;
        uniform float uHasNext;
        uniform float uAspectCurrent;
        uniform float uAspectNext;
        uniform float uContainerAspect;
        varying vec2 vUv;

        vec4 sampleContain(sampler2D tex, vec2 uv, float imgAspect, float contAspect) {
          vec2 targetUv = uv;
          if (imgAspect > contAspect) {
            float scale = contAspect / imgAspect;
            float offset = (1.0 - scale) * 0.5;
            if (uv.y < offset || uv.y > 1.0 - offset) {
              return vec4(0.0);
            }
            targetUv = vec2(uv.x, (uv.y - offset) / scale);
          } else {
            float scale = imgAspect / contAspect;
            float offset = (1.0 - scale) * 0.5;
            if (uv.x < offset || uv.x > 1.0 - offset) {
              return vec4(0.0);
            }
            targetUv = vec2((uv.x - offset) / scale, uv.y);
          }
          return texture2D(tex, targetUv);
        }

        void main() {
          vec4 colA = sampleContain(uTexCurrent, vUv, uAspectCurrent, uContainerAspect);
          if (uHasNext < 0.5) {
            gl_FragColor = colA;
            return;
          }
          vec4 colB = sampleContain(uTexNext, vUv, uAspectNext, uContainerAspect);
          float t = smoothstep(0.0, 1.0, uProgress);
          gl_FragColor = mix(colA, colB, t);
        }
      `;

      const initialLoader = new THREE.TextureLoader();
      initialLoader.load(STORY_CHAPTERS[0].src, (initTex) => {
        initTex.minFilter = THREE.LinearFilter;
        initTex.magFilter = THREE.LinearFilter;
        if (THREE.SRGBColorSpace) {
          initTex.colorSpace = THREE.SRGBColorSpace;
        }
        currentTexture = initTex;

        const rect = visualStage.getBoundingClientRect();
        const stageW = rect.width || 600;
        const stageH = rect.height || 480;
        const containerAspect = stageW / stageH;

        crossfadeMaterial = new THREE.ShaderMaterial({
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
          uniforms: {
            uTexCurrent: { value: currentTexture },
            uTexNext: { value: currentTexture },
            uAspectCurrent: { value: STORY_CHAPTERS[0].aspect },
            uAspectNext: { value: STORY_CHAPTERS[0].aspect },
            uContainerAspect: { value: containerAspect },
            uProgress: { value: 0.0 },
            uHasNext: { value: 0.0 }
          },
          transparent: true
        });

        const fov = 35;
        const cameraZ = 4.5;
        const fovRad = (fov * Math.PI) / 180;
        const visH = 2 * Math.tan(fovRad / 2) * cameraZ;
        const visW = visH * containerAspect;

        const planeGeo = new THREE.PlaneGeometry(visW, visH);
        const storyMesh = new THREE.Mesh(planeGeo, crossfadeMaterial);

        sceneManager = new window.WebGLSceneManager({
          canvas: canvas,
          fov: fov,
          cameraZ: cameraZ,
          alpha: true,
          antialias: true,
          onInit: ({ scene }) => {
            scene.add(storyMesh);
            canvas.classList.remove('opacity-0');
            canvas.classList.add('opacity-100');
          },
          onRender: (timestamp) => {
            if (!crossfadeMaterial) return;

            // Handle photographic crossfade animation
            if (isTransitioning && nextTexture) {
              const elapsed = timestamp - transitionStartTime;
              const progress = Math.min(1.0, elapsed / TRANSITION_DURATION);
              crossfadeMaterial.uniforms.uProgress.value = progress;

              if (progress >= 1.0) {
                isTransitioning = false;
                if (currentTexture) {
                  currentTexture.dispose();
                }
                currentTexture = nextTexture;
                nextTexture = null;
                crossfadeMaterial.uniforms.uTexCurrent.value = currentTexture;
                crossfadeMaterial.uniforms.uAspectCurrent.value = STORY_CHAPTERS[currentIndex].aspect;
                crossfadeMaterial.uniforms.uHasNext.value = 0.0;
                crossfadeMaterial.uniforms.uProgress.value = 0.0;
              }
            }

            // Subtle spatial micro-camera shift (under 2px perceived displacement)
            currentMouseX += (targetMouseX - currentMouseX) * 0.05;
            currentMouseY += (targetMouseY - currentMouseY) * 0.05;

            if (sceneManager && sceneManager.camera) {
              sceneManager.camera.position.x = currentMouseX * 0.03;
              sceneManager.camera.position.y = -currentMouseY * 0.03;
              sceneManager.camera.lookAt(0, 0, 0);
            }
          },
          onResize: (w, h) => {
            if (crossfadeMaterial && storyMesh) {
              const newContAspect = w / h;
              crossfadeMaterial.uniforms.uContainerAspect.value = newContAspect;
              const newFovRad = (sceneManager.camera.fov * Math.PI) / 180;
              const newVisH = 2 * Math.tan(newFovRad / 2) * sceneManager.camera.position.z;
              const newVisW = newVisH * newContAspect;
              storyMesh.geometry.dispose();
              storyMesh.geometry = new THREE.PlaneGeometry(newVisW, newVisH);
            }
          }
        });

        sceneManager.start();
      });
    }

    // Lazy Viewport Observer (250px rootMargin)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!sceneManager && isWebGLUsable) {
            initWebGL();
          } else if (sceneManager) {
            sceneManager.start();
          }
        } else if (sceneManager) {
          sceneManager.pause();
        }
      });
    }, { rootMargin: '250px 0px 250px 0px', threshold: 0.05 });

    observer.observe(storySection);

    // Mouse Parallax Listener (Desktop only, passive)
    if (visualStage) {
      visualStage.addEventListener('mousemove', (e) => {
        const rect = visualStage.getBoundingClientRect();
        targetMouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        targetMouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      }, { passive: true });

      visualStage.addEventListener('mouseleave', () => {
        targetMouseX = 0;
        targetMouseY = 0;
      }, { passive: true });

      // Click Visual Stage -> Open Lightbox
      visualStage.addEventListener('click', () => {
        openStoryLightbox(currentIndex);
      });
    }

    // Tab Button Click & Keyboard Navigation (W3C Tablist Pattern)
    tabButtons.forEach((btn, idx) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goToChapter(idx);
      });

      btn.addEventListener('keydown', (e) => {
        let newIdx = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          newIdx = (idx + 1) % STORY_CHAPTERS.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          newIdx = (idx - 1 + STORY_CHAPTERS.length) % STORY_CHAPTERS.length;
        } else if (e.key === 'Home') {
          newIdx = 0;
        } else if (e.key === 'End') {
          newIdx = STORY_CHAPTERS.length - 1;
        }
        if (newIdx !== null) {
          e.preventDefault();
          goToChapter(newIdx);
          if (tabButtons[newIdx]) {
            tabButtons[newIdx].focus();
          }
        }
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const target = (currentIndex - 1 + STORY_CHAPTERS.length) % STORY_CHAPTERS.length;
        goToChapter(target);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const target = (currentIndex + 1) % STORY_CHAPTERS.length;
        goToChapter(target);
      });
    }

    // Lightbox Integration
    function openStoryLightbox(idx) {
      if (!lightbox || !lbImg) return;
      const chapter = STORY_CHAPTERS[idx];
      lbImg.src = chapter.src;
      lbImg.alt = chapter.caption;
      if (lbTitle) lbTitle.textContent = `Chapter ${chapter.roman} — ${chapter.title}`;
      if (lbCaption) lbCaption.textContent = `${chapter.location} • Aditya & Anjali Wedding`;
      if (lbCounter) lbCounter.textContent = `${idx + 1} / ${STORY_CHAPTERS.length}`;

      lightbox.classList.remove('hidden');
      requestAnimationFrame(() => {
        lightbox.classList.remove('opacity-0');
        lightbox.classList.add('opacity-100', 'flex');
      });
      document.body.classList.add('lb-locked');
    }

    function closeStoryLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove('opacity-100');
      lightbox.classList.add('opacity-0');
      setTimeout(() => {
        lightbox.classList.add('hidden');
        lightbox.classList.remove('flex');
        document.body.classList.remove('lb-locked');
      }, 300);
    }

    if (lbClose) lbClose.addEventListener('click', closeStoryLightbox);
    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeStoryLightbox();
      });
    }
    if (lbPrev) {
      lbPrev.addEventListener('click', () => {
        const target = (currentIndex - 1 + STORY_CHAPTERS.length) % STORY_CHAPTERS.length;
        goToChapter(target);
        openStoryLightbox(target);
      });
    }
    if (lbNext) {
      lbNext.addEventListener('click', () => {
        const target = (currentIndex + 1) % STORY_CHAPTERS.length;
        goToChapter(target);
        openStoryLightbox(target);
      });
    }

    // Keyboard Shortcuts for Lightbox (Arrow navigation & Escape)
    window.addEventListener('keydown', (e) => {
      if (lightbox && !lightbox.classList.contains('hidden')) {
        if (e.key === 'Escape') closeStoryLightbox();
        if (e.key === 'ArrowLeft' && lbPrev) lbPrev.click();
        if (e.key === 'ArrowRight' && lbNext) lbNext.click();
      }
    });

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
      if (currentTexture) currentTexture.dispose();
      if (nextTexture) nextTexture.dispose();
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeddingStory);
  } else {
    initWeddingStory();
  }

})(window);
