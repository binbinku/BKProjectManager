import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { highlightCode, languageForFence } from './code-highlighter';

const api = window.workspaceAPI;
const markdownSchema = {
  ...defaultSchema,
  strip: [...(defaultSchema.strip || []), 'style', 'iframe', 'object', 'embed'],
};

// Markdown paths are relative to the document, but all reads still pass through
// the main process's project boundary checks (including symlinks).
function reference(document: string, value: string) {
  if (!value || value.includes('\\') || value.includes('\0')) return null;
  if (/^(https?:|mailto:)/i.test(value) || value.startsWith('//')) {
    try {
      const url = new URL(value.startsWith('//') ? `https:${value}` : value);
      if (url.username || url.password) return null;
      return { type: 'external' as const, value: url.href };
    } catch {
      return null;
    }
  }
  if (value.startsWith('#')) {
    try {
      return { type: 'anchor' as const, value: decodeURIComponent(value.slice(1)) };
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  try {
    const local = decodeURIComponent(value.split(/[?#]/)[0]);
    if (local.includes('\\') || local.includes('\0') || local.startsWith('//')) return null;
    const parts = local.startsWith('/') ? [] : document.split('/').slice(0, -1);
    for (const part of local.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!parts.length) return null;
        parts.pop();
      } else parts.push(part);
    }
    return { type: 'file' as const, value: parts.join('/') };
  } catch {
    return null;
  }
}

function textContent(children: ReactNode): string {
  return Children.toArray(children)
    .map((child): string =>
      isValidElement<{ children?: ReactNode }>(child)
        ? textContent(child.props.children)
        : typeof child === 'string' || typeof child === 'number'
          ? String(child)
          : '',
    )
    .join('');
}
function headingId(children: ReactNode) {
  return textContent(children)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const element = Children.toArray(children)[0];
  const props = isValidElement<{ children?: ReactNode; className?: string }>(element)
    ? element.props
    : {};
  const content = textContent(props.children);
  const language = languageForFence(props.className?.replace('language-', '') || '');
  const [html, setHTML] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setHTML(null);
    if (language && content.length <= 200_000)
      void highlightCode(content, language).then(
        (result) => {
          if (current) setHTML(result);
        },
        () => {},
      );
    return () => {
      current = false;
    };
  }, [content, language]);
  return html === null ? (
    <pre className="markdown-code-block">
      <code>{content}</code>
    </pre>
  ) : (
    <div className="markdown-code-block code-content" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

async function imageSource(sessionId: string, document: string, src: string) {
  const target = reference(document, src);
  if (target?.type === 'external' && /^https?:/i.test(target.value)) return target.value;
  if (target?.type !== 'file') throw new Error('不支持此图片地址');
  const file = await api.readProjectFile(sessionId, target.value);
  if (file.kind !== 'image')
    throw new Error(file.kind === 'unsupported' ? file.reason : '此路径不是图片文件');
  return file.dataURL;
}

function MarkdownImage({
  sessionId,
  document,
  src,
  alt,
  width,
  height,
  title,
}: {
  sessionId: string;
  document: string;
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  title?: string;
}) {
  const [data, setData] = useState<string>();
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setData(undefined);
    setError('');
    void imageSource(sessionId, document, src).then(
      (url) => {
        if (current) setData(url);
      },
      (reason) => {
        if (current) setError(reason instanceof Error ? reason.message : '无法读取图片');
      },
    );
    return () => {
      current = false;
    };
  }, [sessionId, document, src]);
  return error ? (
    <span
      className="markdown-image-fallback"
      role="img"
      aria-label={`${alt || '图片'}（加载失败）`}
      title={`${src}\n${error}`}
    >
      图片加载失败{alt ? `：${alt}` : ''}
    </span>
  ) : (
    <img
      src={data}
      alt={alt}
      width={width}
      height={height}
      title={title}
      referrerPolicy="no-referrer"
      onError={() => setError('无法加载图片，请检查地址或网络连接')}
    />
  );
}

function PictureSource({
  sessionId,
  document,
  srcSet,
  media,
}: {
  sessionId: string;
  document: string;
  srcSet?: string;
  media?: string;
}) {
  const [resolved, setResolved] = useState<string>();
  useEffect(() => {
    let current = true;
    setResolved(undefined);
    // Resolve every candidate ourselves; raw file:// URLs and project escapes
    // never reach Chromium through a picture's otherwise independent srcset.
    const candidates = (srcSet || '').split(',').map((item) => item.trim().split(/\s+/));
    if (
      !srcSet ||
      candidates.length > 8 ||
      candidates.some(
        ([src, descriptor, extra]) =>
          !src || extra || (descriptor && !/^(?:\d+(?:\.\d+)?x|\d+w)$/.test(descriptor)),
      )
    )
      return;
    void Promise.all(
      candidates.map(
        async ([src, descriptor]) =>
          `${await imageSource(sessionId, document, src)}${descriptor ? ` ${descriptor}` : ''}`,
      ),
    ).then(
      (values) => {
        if (current) setResolved(values.join(', '));
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [sessionId, document, srcSet]);
  return resolved ? <source srcSet={resolved} media={media} /> : null;
}

export function MarkdownPreview({
  content,
  path,
  sessionId,
  onNavigate,
  onError,
}: {
  content: string;
  path: string;
  sessionId: string;
  onNavigate(path: string): void;
  onError(message: string): void;
}) {
  const external = (value: string) => {
    void api
      .openMarkdownLink(sessionId, value)
      .catch((reason) => onError(String(reason.message || reason)));
  };
  return (
    <article className="markdown-document" aria-label="Markdown 阅读预览">
      {content ? (
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
          components={{
            pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
            h1: ({ children }) => <h1 id={headingId(children)}>{children}</h1>,
            h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>,
            h3: ({ children }) => <h3 id={headingId(children)}>{children}</h3>,
            h4: ({ children }) => <h4 id={headingId(children)}>{children}</h4>,
            h5: ({ children }) => <h5 id={headingId(children)}>{children}</h5>,
            h6: ({ children }) => <h6 id={headingId(children)}>{children}</h6>,
            a: ({ href, children }) => {
              const target = reference(path, href || '');
              return target ? (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    if (target.type === 'external') external(target.value);
                    else if (target.type === 'file') onNavigate(target.value);
                    else
                      event.currentTarget
                        .closest('article')
                        ?.querySelectorAll('[id]')
                        .forEach((node) => {
                          if (node.id === target.value) node.scrollIntoView({ block: 'start' });
                        });
                  }}
                >
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              );
            },
            img: ({ src, alt, width, height, title }) => (
              <MarkdownImage
                key={src}
                sessionId={sessionId}
                document={path}
                src={typeof src === 'string' ? src : ''}
                alt={alt || ''}
                width={width}
                height={height}
                title={title}
              />
            ),
            source: ({ srcSet, media }) => (
              <PictureSource
                key={srcSet}
                sessionId={sessionId}
                document={path}
                srcSet={srcSet}
                media={media}
              />
            ),
          }}
        >
          {content}
        </Markdown>
      ) : (
        <p className="markdown-empty">这是一份空白 Markdown 文档，点击右下角开始编辑。</p>
      )}
    </article>
  );
}
