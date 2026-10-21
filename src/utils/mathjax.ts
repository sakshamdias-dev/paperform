// MathJax loader & rendering utility

declare global {
  interface Window {
    MathJax: any;
  }
}

let isRendering = false;
let pendingRender = false;

export function initMathJax(): void {
  if (typeof window === 'undefined') return;

  if (!window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['$$', '$$']],
        macros: {
          degree: '^\\circ',
        },
      },
      svg: {
        fontCache: 'global',
      },
      options: {
        ignoreHtmlClass: 'ql-editor',
      },
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.async = true;
    script.onload = () => {
      renderMath();
    };
    document.head.appendChild(script);
  }
}

export function renderMath(elements?: (HTMLElement | null)[]): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  initMathJax();

  if (!window.MathJax?.typesetPromise) {
    setTimeout(() => renderMath(elements), 120);
    return Promise.resolve();
  }

  if (isRendering) {
    pendingRender = true;
    return Promise.resolve();
  }

  isRendering = true;
  const target = elements && elements.length > 0 ? elements.filter(Boolean) : undefined;

  return window.MathJax.typesetPromise(target)
    .catch((err: any) => {
      console.warn('MathJax error:', err);
    })
    .finally(() => {
      isRendering = false;
      if (pendingRender) {
        pendingRender = false;
        renderMath();
      }
    });
}
