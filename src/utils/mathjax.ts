// MathJax loader & rendering utility

declare global {
  interface Window {
    MathJax: any;
  }
}

let isRendering = false;
let pendingRender = false;

export function cleanImageHtml(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/(<img\b[^>]*?style=["'][^"']*?)outline\s*:\s*[^;"]+;?/gi, '$1')
    .replace(/(<img\b[^>]*?)\s*style=["']\s*["']/gi, '$1');
}

export function preprocessMathHtml(html: string | undefined | null): string {
  if (!html) return '';
  let processed = cleanImageHtml(html.replace(/&nbsp;/g, ' '));

  // Convert Quill formula embeds: <span class="ql-formula" data-value="...">...</span>
  processed = processed.replace(
    /<span[^>]*class=["'][^"']*ql-formula[^"']*["'][^>]*data-value=["']([^"']*)["'][^>]*>[\s\S]*?<\/span>/gi,
    (_match, val) => `\\(${val}\\)`
  );
  processed = processed.replace(
    /<span[^>]*data-value=["']([^"']*)["'][^>]*class=["'][^"']*ql-formula[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
    (_match, val) => `\\(${val}\\)`
  );

  return processed;
}

export function initMathJax(): void {
  if (typeof window === 'undefined') return;

  if (!window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [['\\(', '\\)'], ['$', '$']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true,
        macros: {
          degree: '^\\circ',
        },
      },
      svg: {
        fontCache: 'local', // Embed glyph paths directly in each SVG so cloned containers render everywhere
      },
      options: {
        ignoreHtmlClass: 'ql-editor',
      },
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.async = true;
    script.onload = () => {
      void renderMath();
    };
    document.head.appendChild(script);
  }
}

export function renderMath(elements?: (HTMLElement | null)[]): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  initMathJax();

  return new Promise<void>((resolve) => {
    let retries = 0;
    const tryRender = () => {
      if (!window.MathJax?.typesetPromise) {
        if (retries < 40) {
          retries++;
          setTimeout(tryRender, 60);
          return;
        }
        resolve();
        return;
      }

      if (isRendering) {
        pendingRender = true;
        setTimeout(tryRender, 50);
        return;
      }

      isRendering = true;
      const target = elements && elements.length > 0 ? elements.filter(Boolean) : undefined;

      window.MathJax.typesetPromise(target)
        .catch((err: any) => {
          console.warn('MathJax error:', err);
        })
        .finally(() => {
          isRendering = false;
          if (pendingRender) {
            pendingRender = false;
            void renderMath();
          }
          resolve();
        });
    };

    tryRender();
  });
}

