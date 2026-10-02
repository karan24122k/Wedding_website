/**
 * Kumar Video & Photography - WebGL Core Foundation (Phase 1)
 * Architecture & Fallback Foundation
 *
 * Provides:
 * 1. Global configuration & debug switch (WEBGL_CONFIG, ?webgl=false, localStorage)
 * 2. Strict WebGL capability detection
 * 3. Comprehensive device profiling (mobile, low-end, touch, reduced-motion)
 * 4. Adaptive device-aware DPR calculator
 * 5. Fallback lifecycle manager (adds .has-webgl / .no-webgl classes, dispatches events)
 */

(function(window) {
  'use strict';

  // 1. Global Configuration & Feature Flag
  // Can be configured in code, via URL query (?webgl=false / ?webgl=0), or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const paramKill = urlParams.get('webgl') === '0' || 
                    urlParams.get('webgl') === 'false' || 
                    urlParams.get('nowebgl') === '1';

  const localKill = window.localStorage.getItem('disable_webgl') === 'true';

  const WEBGL_CONFIG = {
    enabled: !(paramKill || localKill),
    debug: urlParams.get('webgl_debug') === '1',
    maxDesktopDPR: 1.5,
    maxMobileDPR: 1.25,
    lowEndDPR: 1.0,
    forceFallback: false
  };

  window.WEBGL_CONFIG = WEBGL_CONFIG;

  // 2. Device & Environment Profiling
  function checkTouch() {
    return (
      'ontouchstart' in window ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );
  }

  function checkReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function checkLowEndDevice() {
    // Check CPU concurrency
    const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
    // Check device memory (RAM)
    const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
    // Check network save-data
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    const slowNet = !!(navigator.connection && typeof navigator.connection.effectiveType === 'string' && navigator.connection.effectiveType.includes('2g'));

    return lowCores || lowMemory || saveData || slowNet;
  }

  function checkMobile() {
    return window.innerWidth < 768 || checkTouch();
  }

  // 3. WebGL Capability Detection
  function detectWebGLContext() {
    if (!WEBGL_CONFIG.enabled || WEBGL_CONFIG.forceFallback) {
      return false;
    }

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', { powerPreference: 'default' }) ||
                 canvas.getContext('experimental-webgl');
      const isSupported = !!(gl && gl instanceof WebGLRenderingContext);
      
      // Clean up test context
      if (gl) {
        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
          loseContext.loseContext();
        }
      }
      return isSupported;
    } catch (e) {
      return false;
    }
  }

  const isSupported = detectWebGLContext();

  // 4. Adaptive DPR Strategy
  function getAdaptiveDPR() {
    const baseDpr = window.devicePixelRatio || 1;

    if (checkLowEndDevice()) {
      return WEBGL_CONFIG.lowEndDPR;
    }
    if (checkMobile()) {
      return Math.min(baseDpr, WEBGL_CONFIG.maxMobileDPR);
    }
    return Math.min(baseDpr, WEBGL_CONFIG.maxDesktopDPR);
  }

  // 5. Fallback DOM & Lifecycle Synchronization
  const docEl = document.documentElement;
  if (isSupported) {
    docEl.classList.remove('no-webgl');
    docEl.classList.add('has-webgl');
    if (WEBGL_CONFIG.debug) {
      console.info('[KumarWebGL] WebGL capability verified. DPR target:', getAdaptiveDPR());
    }
  } else {
    docEl.classList.remove('has-webgl');
    docEl.classList.add('no-webgl');
    if (WEBGL_CONFIG.debug) {
      console.info('[KumarWebGL] WebGL unavailable or disabled. Fallback active.');
    }
  }

  // Allow programmatic disable/enable at runtime
  function setWebGLEnabled(enabled) {
    WEBGL_CONFIG.enabled = !!enabled;
    if (enabled) {
      window.localStorage.removeItem('disable_webgl');
    } else {
      window.localStorage.setItem('disable_webgl', 'true');
    }
    // Update classes and dispatch event
    const active = detectWebGLContext();
    docEl.classList.toggle('has-webgl', active);
    docEl.classList.toggle('no-webgl', !active);
    window.dispatchEvent(new CustomEvent('webgl:statuschange', { detail: { enabled: active } }));
  }

  // Public API
  window.KumarWebGL = {
    config: WEBGL_CONFIG,
    isSupported: isSupported,
    isMobile: checkMobile,
    isTouch: checkTouch,
    isLowEnd: checkLowEndDevice,
    prefersReducedMotion: checkReducedMotion,
    getAdaptiveDPR: getAdaptiveDPR,
    setEnabled: setWebGLEnabled
  };

})(window);
