import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidDiagram from './MermaidDiagram';
import './styles/gh-md-light.css';
import './styles/gh-md-dark.css';
import './styles/markdown-doc-shell.css';

/**
 * Renders Markdown with GitHub.com-like typography and spacing (github-markdown-css,
 * scoped to theme). GFM: tables, task lists, strikethrough, autolinks. Fenced
 * ```mermaid uses the app Mermaid widget.
 */
export default function MarkdownDoc({ source, isDark }) {
  const text = typeof source === 'string' ? source : '';
  const themeClass = isDark ? 'gh-md-dark' : 'gh-md-light';

  return (
    <div className={`markdown-doc-root ${themeClass}`}>
      <article className="markdown-body">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            /** Avoid invalid <p><pre> when the parser nests block code inside a paragraph (GFM edge cases). */
            p({ children, ...props }) {
              const blockish = React.Children.toArray(children).some((child) => {
                if (!React.isValidElement(child)) return false;
                const T = child.type;
                return T === 'pre' || T === 'div';
              });
              if (blockish) {
                return (
                  <div className="markdown-body-paragraph-shell" {...props}>
                    {children}
                  </div>
                );
              }
              return <p {...props}>{children}</p>;
            },
            code({ inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const lang = match?.[1];
              const raw = String(children).replace(/\n$/, '');

              if (!inline && lang === 'mermaid') {
                return (
                  <div className="markdown-body-mermaid-embed my-4 overflow-hidden rounded-lg border border-[var(--borderColor-default,#d1d9e0)]">
                    <MermaidDiagram definition={raw} isDark={isDark} />
                  </div>
                );
              }

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }

              return (
                <pre>
                  <code className={className} {...props}>
                    {raw}
                  </code>
                </pre>
              );
            },
            a({ href, children, ...rest }) {
              const external = typeof href === 'string' && /^https?:\/\//i.test(href);
              return (
                <a
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  {...rest}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {text}
        </Markdown>
      </article>
    </div>
  );
}
