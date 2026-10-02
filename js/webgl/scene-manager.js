/**
 * Kumar Video & Photography - Reusable WebGL Scene Manager (Phase 1)
 *
 * Provides a production-grade lifecycle container for Three.js scenes:
 * 1. Safe renderer initialization with WebGL context error trapping
 * 2. Viewport-driven rendering loop (IntersectionObserver): minimizes CPU/GPU usage when off-screen
 * 3. Dynamic resize and adaptive DPR management
 * 4. WebGL context loss & context restoration handlers (webglcontextlost / webglcontextrestored)
 * 5. Complete memory & resource cleanup (textures, geometries, materials, listeners)
 */

(function(window) {
  'use strict';

  class WebGLSceneManager {
    /**
     * @param {Object} options
     * @param {HTMLCanvasElement} options.canvas - The target canvas element
     * @param {Function} [options.onInit] - Callback invoked with (scene, camera, renderer)
     * @param {Function} [options.onRender] - Callback invoked every active animation frame with (timestamp, delta)
     * @param {Function} [options.onResize] - Callback invoked on canvas resize with (width, height, aspect)
     * @param {Function} [options.onContextLost] - Callback on WebGL context loss
     * @param {Function} [options.onContextRestored] - Callback on WebGL context restoration
     * @param {number} [options.fov=45] - Camera vertical field of view
     * @param {number} [options.near=0.1] - Camera near clipping plane
     * @param {number} [options.far=100] - Camera far clipping plane
     * @param {boolean} [options.alpha=true] - Transparent canvas background
     * @param {boolean} [options.antialias] - Antialiasing flag (defaults to non-mobile)
     */
    constructor(options = {}) {
      this.canvas = options.canvas;
      this.options = options;

      this.scene = null;
      this.camera = null;
      this.renderer = null;

      this.isRunning = false;
      this.isInViewport = false;
      this.isContextLost = false;
      this.rafId = null;
      this.lastTimestamp = 0;

      this.observer = null;
      this._boundResize = this.handleResize.bind(this);
      this._boundContextLost = this.handleContextLost.bind(this);
      this._boundContextRestored = this.handleContextRestored.bind(this);
      this._boundLoop = this.renderLoop.bind(this);

      // Initialize if canvas is provided and WebGL is enabled
      if (this.canvas) {
        this.init();
      }
    }

    init() {
      if (!window.KumarWebGL || !window.KumarWebGL.isSupported || typeof THREE === 'undefined') {
        return false;
      }
      if (!this.canvas) return false;

      const rect = this.canvas.getBoundingClientRect();
      const parent = this.canvas.parentElement;
      this.width = rect.width || (parent ? parent.clientWidth : window.innerWidth);
      this.height = rect.height || (parent ? parent.clientHeight : window.innerHeight);

      try {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
          this.options.fov || 45,
          (this.width / this.height) || 1,
          this.options.near || 0.1,
          this.options.far || 100
        );
        this.camera.position.z = this.options.cameraZ || 5;

        const isMobile = window.KumarWebGL.isMobile();
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          alpha: this.options.alpha !== false,
          antialias: this.options.antialias !== undefined ? this.options.antialias : !isMobile,
          powerPreference: 'high-performance'
        });

        const dpr = window.KumarWebGL.getAdaptiveDPR();
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(this.width, this.height, false);

        if (THREE.SRGBColorSpace) {
          this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        }

        // WebGL context loss listeners
        this.canvas.addEventListener('webglcontextlost', this._boundContextLost, false);
        this.canvas.addEventListener('webglcontextrestored', this._boundContextRestored, false);

        // Resize listener
        window.addEventListener('resize', this._boundResize, { passive: true });

        // Viewport Visibility Observer (Minimizes CPU/GPU usage when offscreen)
        this.setupViewportObserver();

        // Custom init callback
        if (typeof this.options.onInit === 'function') {
          this.options.onInit({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            width: this.width,
            height: this.height
          });
        }

        return true;
      } catch (err) {
        console.warn('[WebGLSceneManager] Initialization error:', err);
        this.cleanup();
        return false;
      }
    }

    setupViewportObserver() {
      if (!('IntersectionObserver' in window)) {
        this.isInViewport = true;
        this.start();
        return;
      }

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.isInViewport = true;
            this.resume();
          } else {
            this.isInViewport = false;
            this.pause();
          }
        });
      }, {
        rootMargin: '100px 0px', // Pre-activate slightly before entering viewport
        threshold: 0.01
      });

      this.observer.observe(this.canvas);
    }

    start() {
      if (this.isRunning || !this.renderer || this.isContextLost) return;
      this.isRunning = true;
      this.lastTimestamp = performance.now();
      this.rafId = requestAnimationFrame(this._boundLoop);
    }

    pause() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    resume() {
      if (this.isInViewport && !this.isRunning && !this.isContextLost) {
        this.start();
      }
    }

    stop() {
      this.pause();
    }

    renderLoop(timestamp) {
      if (!this.isRunning || this.isContextLost) return;

      const delta = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = timestamp;

      // User custom render callback
      if (typeof this.options.onRender === 'function') {
        this.options.onRender(timestamp, delta);
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      this.rafId = requestAnimationFrame(this._boundLoop);
    }

    handleResize() {
      if (!this.canvas || !this.renderer || !this.camera) return;

      const parent = this.canvas.parentElement;
      const rect = this.canvas.getBoundingClientRect();
      this.width = rect.width || (parent ? parent.clientWidth : window.innerWidth);
      this.height = rect.height || (parent ? parent.clientHeight : window.innerHeight);

      if (this.camera.isPerspectiveCamera) {
        this.camera.aspect = (this.width / this.height) || 1;
        this.camera.updateProjectionMatrix();
      }

      const dpr = window.KumarWebGL.getAdaptiveDPR();
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(this.width, this.height, false);

      if (typeof this.options.onResize === 'function') {
        this.options.onResize(this.width, this.height, this.camera.aspect);
      }
    }

    handleContextLost(e) {
      if (e) e.preventDefault();
      this.isContextLost = true;
      this.pause();
      console.warn('[WebGLSceneManager] WebGL Context Lost. Pausing render loop.');
      if (typeof this.options.onContextLost === 'function') {
        this.options.onContextLost();
      }
    }

    handleContextRestored() {
      this.isContextLost = false;
      console.info('[WebGLSceneManager] WebGL Context Restored. Re-initializing scene.');
      this.cleanup(false);
      this.init();
      if (typeof this.options.onContextRestored === 'function') {
        this.options.onContextRestored();
      }
    }

    /**
     * Clean up all Three.js resources to prevent memory leaks
     */
    cleanup(disconnectObserver = true) {
      this.pause();

      if (disconnectObserver && this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      window.removeEventListener('resize', this._boundResize);

      if (this.canvas) {
        this.canvas.removeEventListener('webglcontextlost', this._boundContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this._boundContextRestored);
      }

      // Dispose scene objects recursively
      if (this.scene) {
        this.scene.traverse((obj) => {
          if (!obj) return;
          if (obj.geometry) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => this.disposeMaterial(m));
            } else {
              this.disposeMaterial(obj.material);
            }
          }
        });
        this.scene.clear();
      }

      if (this.renderer) {
        this.renderer.dispose();
        this.renderer = null;
      }

      this.scene = null;
      this.camera = null;
    }

    destroy() {
      this.cleanup();
    }

    disposeMaterial(mat) {
      if (!mat) return;
      Object.keys(mat).forEach(prop => {
        const val = mat[prop];
        if (val && typeof val === 'object' && 'minFilter' in val) {
          val.dispose(); // Texture disposal
        }
      });
      mat.dispose();
    }
  }

  // Export to global scope
  window.WebGLSceneManager = WebGLSceneManager;

})(window);
