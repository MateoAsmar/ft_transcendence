/**
 * Browser Compatibility and Polyfills
 * Ensures the application works across all modern browsers and devices
 */

// Type definitions for browser compatibility
interface BrowserCompatibility {
  hasTouch: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isFirefox: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isIE: boolean;
  supportsPassive: boolean;
  smoothScrollTo: (element: Element, to: number, duration?: number) => void;
}

// Declare global window extension
declare global {
  interface Window {
    browserCompatibility: BrowserCompatibility;
  }
}

// Check if we're in a browser environment
if (typeof window !== 'undefined') {

  // 1. CSS Custom Properties (CSS Variables) Polyfill for IE
  if (!window.CSS || !window.CSS.supports || !window.CSS.supports('color', 'var(--test-var)')) {
    console.warn('CSS Custom Properties not supported, loading polyfill...');
    // In a real environment, you'd load a polyfill library here
  }

  // 2. Intersection Observer Polyfill
  if (!('IntersectionObserver' in window)) {
    console.warn('IntersectionObserver not supported');
    // Fallback for older browsers
    (window as any).IntersectionObserver = class {
      private callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe(): void {
        // Simple fallback - just call callback immediately
        this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as any);
      }

      unobserve(): void {}
      disconnect(): void {}
    };
  }

  // 3. ResizeObserver Polyfill
  if (!('ResizeObserver' in window)) {
    console.warn('ResizeObserver not supported, using fallback');
    (window as any).ResizeObserver = class {
      private callback: ResizeObserverCallback;
      private observed: Set<Element>;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        this.observed = new Set();
      }

      observe(element: Element): void {
        this.observed.add(element);
        // Fallback using window resize
        if (this.observed.size === 1) {
          window.addEventListener('resize', () => {
            this.callback([{ target: element } as ResizeObserverEntry], this as any);
          });
        }
      }

      unobserve(element: Element): void {
        this.observed.delete(element);
      }

      disconnect(): void {
        this.observed.clear();
      }
    };
  }

  // 4. requestAnimationFrame Polyfill
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(callback: FrameRequestCallback): number {
      return window.setTimeout(callback, 1000 / 60);
    };
    window.cancelAnimationFrame = function(id: number): void {
      clearTimeout(id);
    };
  }

  // 5. Performance.now() Polyfill
  if (!window.performance || !window.performance.now) {
    window.performance = window.performance || ({} as Performance);
    window.performance.now = function(): number {
      return Date.now();
    };
  }

  // 6. Passive Event Listener Support Detection
  let supportsPassive = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get: function() {
        supportsPassive = true;
        return false;
      }
    });
    window.addEventListener('testPassive', null as any, opts);
    window.removeEventListener('testPassive', null as any, opts);
  } catch (e) {
    // Silent catch
  }

  // 7. Touch Event Support Detection
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // 8. Device Detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(navigator.userAgent);
  const isDesktop = !isMobile && !isTablet;

  // 9. Browser Detection
  const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
  const isEdge = /Edge/.test(navigator.userAgent);
  const isIE = /Trident/.test(navigator.userAgent);

  // 10. Add compatibility classes to document
  document.documentElement.classList.add(
    hasTouch ? 'has-touch' : 'no-touch',
    isMobile ? 'is-mobile' : 'not-mobile',
    isTablet ? 'is-tablet' : 'not-tablet',
    isDesktop ? 'is-desktop' : 'not-desktop'
  );

  // Browser-specific classes
  if (isFirefox) document.documentElement.classList.add('firefox');
  if (isChrome) document.documentElement.classList.add('chrome');
  if (isSafari) document.documentElement.classList.add('safari');
  if (isEdge) document.documentElement.classList.add('edge');
  if (isIE) document.documentElement.classList.add('ie');

  // 11. Fix for iOS Safari zoom on input focus
  if (isMobile && isSafari) {
    const addViewportMeta = (): void => {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
    };

    document.addEventListener('focusin', (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches('input, select, textarea')) {
        addViewportMeta();
      }
    });
  }

  // 12. Smooth Scrolling Polyfill
  if (!('scrollBehavior' in document.documentElement.style)) {
    const smoothScrollTo = (element: Element, to: number, duration: number = 300): void => {
      const start = element.scrollTop;
      const change = to - start;
      const startTime = performance.now();

      const animateScroll = (currentTime: number): void => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeInOutQuad = (progress: number): number =>
          progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        element.scrollTop = start + change * easeInOutQuad(progress);

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    };

    // Override smooth scroll behavior
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = function(this: Element, options?: ScrollToOptions | number, y?: number): void {
      if (typeof options === 'object' && options.behavior === 'smooth') {
        smoothScrollTo(this, options.top || 0);
      } else {
        originalScrollTo.call(this, options as any, y || 0);
      }
    };
  }

  // 13. Flexible Touch Handling
  const addTouchSupport = (): void => {
    if (hasTouch) {
      // Prevent double-tap zoom on touch devices
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e: TouchEvent) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, false);

      // Add touch class for styling
      document.body.classList.add('touch-device');
    }
  };

  // 14. Viewport Height Fix for Mobile Browsers
  const setViewportHeight = (): void => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  // 15. Loading and Error Handling for Images
  const improveImageLoading = (): void => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      img.addEventListener('error', function(this: HTMLImageElement) {
        this.style.display = 'none';
        console.warn(`Failed to load image: ${this.src}`);
      });
    });
  };

  // 16. Initialize everything when DOM is ready
  const initCompatibility = (): void => {
    addTouchSupport();
    setViewportHeight();
    improveImageLoading();

    // Re-calculate viewport height on resize and orientation change
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => {
      setTimeout(setViewportHeight, 100);
    });
  };

  // 17. Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCompatibility);
  } else {
    initCompatibility();
  }

  // 18. Export compatibility info for use by other scripts
  window.browserCompatibility = {
    hasTouch,
    isMobile,
    isTablet,
    isDesktop,
    isFirefox,
    isChrome,
    isSafari,
    isEdge,
    isIE,
    supportsPassive,
    smoothScrollTo: (element: Element, to: number, duration?: number): void => {
      if ('scrollBehavior' in document.documentElement.style) {
        element.scrollTo({ top: to, behavior: 'smooth' });
      } else {
        const smoothScrollTo = (element: Element, to: number, duration: number = 300): void => {
          const start = element.scrollTop;
          const change = to - start;
          const startTime = performance.now();

          const animateScroll = (currentTime: number): void => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeInOutQuad = (progress: number): number =>
              progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

            element.scrollTop = start + change * easeInOutQuad(progress);

            if (progress < 1) {
              requestAnimationFrame(animateScroll);
            }
          };

          requestAnimationFrame(animateScroll);
        };
        smoothScrollTo(element, to, duration);
      }
    }
  };

  // 19. Console info for debugging
  console.log('Browser Compatibility initialized:', {
    browser: isFirefox ? 'Firefox' : isChrome ? 'Chrome' : isSafari ? 'Safari' : isEdge ? 'Edge' : isIE ? 'IE' : 'Unknown',
    device: isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop',
    touch: hasTouch,
    passive: supportsPassive
  });
}

export {};
