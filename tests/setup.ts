import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout. Give React Flow deterministic synthetic measurements;
// this exercises the real graph components, not a replacement implementation.
Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: {
    configurable: true,
    get() {
      return this.classList.contains('react-flow__node') ? 330 : 1000;
    },
  },
  offsetHeight: {
    configurable: true,
    get() {
      return this.classList.contains('react-flow__node') ? 460 : 800;
    },
  },
});
class TestResizeObserver implements ResizeObserver {
  private targets = new Set<Element>();
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.targets.add(target);
    queueMicrotask(() => {
      if (this.targets.has(target))
        this.callback(
          [{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry],
          this,
        );
    });
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
}
globalThis.ResizeObserver = TestResizeObserver;
Object.defineProperty(window, 'DOMMatrixReadOnly', {
  configurable: true,
  value: class {
    m22 = 1;
  },
});
Object.defineProperty(SVGElement.prototype, 'getBBox', {
  configurable: true,
  value: () => ({ x: 0, y: 0, width: 160, height: 20 }),
});
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  }),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
