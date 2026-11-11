import { Fragment, useMemo } from 'react';
import katex from 'katex';

/** Renders text that contains inline math delimited by $...$ using KaTeX. */
export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const parts = text.split(/(\$[^$]+\$)/g);
    return parts.map((part) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        try {
          return { math: true, html: katex.renderToString(part.slice(1, -1), { throwOnError: false }) };
        } catch {
          return { math: false, html: part };
        }
      }
      return { math: false, html: part };
    });
  }, [text]);

  return (
    <span className={className}>
      {html.map((p, i) =>
        p.math ? <span key={i} dangerouslySetInnerHTML={{ __html: p.html }} /> : <Fragment key={i}>{p.html}</Fragment>
      )}
    </span>
  );
}

