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

export function latexToQuillFormula(html: string | undefined | null): string {
  if (!html) return '';
  let processed = html;

  // Convert \( ... \) delimiters to Quill formula embed format
  processed = processed.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_match, latex) => {
      const cleanLatex = latex.replace(/&nbsp;/g, ' ').trim();
      return `<span class="ql-formula" data-value="${cleanLatex.replace(/"/g, '&quot;')}"></span>`;
    }
  );

  // Convert \[ ... \] delimiters
  processed = processed.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_match, latex) => {
      const cleanLatex = latex.replace(/&nbsp;/g, ' ').trim();
      return `<span class="ql-formula" data-value="${cleanLatex.replace(/"/g, '&quot;')}"></span>`;
    }
  );

  // Convert $$ ... $$ delimiters
  processed = processed.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_match, latex) => {
      const cleanLatex = latex.replace(/&nbsp;/g, ' ').trim();
      return `<span class="ql-formula" data-value="${cleanLatex.replace(/"/g, '&quot;')}"></span>`;
    }
  );

  return processed;
}

function decodeHtmlAttr(val: string): string {
  return val
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/**
 * Replaces balanced `<span class="ql-formula" data-value="...">...</span>` elements
 * (including any nested KaTeX `<span>` children) with `\( ... \)`.
 */
export function replaceQuillFormulas(html: string): string {
  if (!html || !html.includes('ql-formula')) return html || '';

  let result = '';
  let cursor = 0;
  const openSpanRegex = /<span\b([^>]*)>/gi;

  while (cursor < html.length) {
    openSpanRegex.lastIndex = cursor;
    const match = openSpanRegex.exec(html);
    if (!match) {
      result += html.slice(cursor);
      break;
    }

    const attrs = match[1] || '';
    const isFormula = /\bclass\s*=\s*(?:"[^"]*\bql-formula\b[^"]*"|'[^']*\bql-formula\b[^']*')/i.test(attrs);
    if (!isFormula) {
      // Advance past this opening tag without consuming it as a formula
      result += html.slice(cursor, match.index + match[0].length);
      cursor = match.index + match[0].length;
      continue;
    }

    const dataValMatch = attrs.match(/\bdata-value\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const rawLatex = dataValMatch ? (dataValMatch[1] ?? dataValMatch[2] ?? '') : '';
    const cleanLatex = decodeHtmlAttr(rawLatex).trim();

    // Walk forward to find the matching </span> for this <span class="ql-formula">
    result += html.slice(cursor, match.index);
    let scanPos = match.index + match[0].length;
    let depth = 1;
    const tagRegex = /<\/?span\b[^>]*>/gi;
    tagRegex.lastIndex = scanPos;

    let endPos = -1;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(html)) !== null) {
      if (tagMatch[0].startsWith('</')) {
        depth -= 1;
        if (depth === 0) {
          endPos = tagMatch.index + tagMatch[0].length;
          break;
        }
      } else if (!tagMatch[0].endsWith('/>')) {
        depth += 1;
      }
    }

    if (endPos === -1) {
      // Unclosed span fallback: replace just the opening tag
      endPos = match.index + match[0].length;
    }

    result += cleanLatex ? `\\(${cleanLatex}\\)` : '';
    cursor = endPos;
  }

  return result;
}

export function quillFormulaToLatex(html: string | undefined | null): string {
  if (!html) return '';
  return replaceQuillFormulas(html);
}

export function preprocessMathHtml(html: string | undefined | null): string {
  if (!html) return '';
  let processed = cleanImageHtml(html);

  // Convert Quill formula embeds (handling arbitrarily nested KaTeX <span>s)
  processed = replaceQuillFormulas(processed).replace(/\uFEFF/g, '');

  // Clean &nbsp; only inside LaTeX math delimiters so MathJax parses formulas cleanly while preserving blank spaces in text
  processed = processed
    .replace(/\\\([\s\S]*?\\\)/g, (m) => m.replace(/&nbsp;/g, ' '))
    .replace(/\\\[[\s\S]*?\\\]/g, (m) => m.replace(/&nbsp;/g, ' '))
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => m.replace(/&nbsp;/g, ' '));

  // Convert isolated single &nbsp; between words (from Quill 2 getSemanticHTML) back to normal spaces
  // so text-align: justify and word wrapping work properly, while preserving all multi-space runs (&nbsp;&nbsp;, " &nbsp;") and empty lines (<p>&nbsp;</p>)
  processed = processed
    .replace(/([^\s>&;])&nbsp;([^\s<&])/g, '$1 $2')
    .replace(/([^\s>&;])&nbsp;([^\s<&])/g, '$1 $2');

  // Ensure empty Quill paragraphs (<p><br></p>, <p></p>) render as visible blank lines
  processed = processed
    .replace(/<p(\s[^>]*)?>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '<p$1>&nbsp;</p>');

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

