import { useEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, FolderOpen, Loader2 } from 'lucide-react';
import { highlightCode, languageForPath } from './code-highlighter';
import type { FilePreview } from './types';

export const formatBytes = (size: number) =>
  size < 1024
    ? `${size} B`
    : size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} KiB`
      : `${(size / 1024 / 1024).toFixed(1)} MiB`;

export function FileViewer({
  selected,
  preview,
  loading,
  error,
  onReload,
}: {
  selected: string | null;
  preview: FilePreview | null;
  loading: boolean;
  error: string;
  onReload(): void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const language = languageForPath(selected);
  const content = preview?.kind === 'text' ? preview.content : '';
  const [highlighted, setHighlighted] = useState<{
    content: string;
    language: string;
    html: string;
  } | null>(null);
  useEffect(() => {
    let current = true;
    setHighlighted(null);
    if (language && content.length <= 200_000) {
      void highlightCode(content, language).then(
        (html) => {
          if (current) setHighlighted({ content, language, html });
        },
        () => {},
      );
    }
    return () => {
      current = false;
    };
  }, [content, language]);
  const highlightedHTML =
    highlighted?.content === content && highlighted?.language === language
      ? highlighted.html
      : null;
  const lines = useMemo(
    () => Array.from({ length: content.split('\n').length }, (_, index) => index + 1).join('\n'),
    [content],
  );
  useEffect(() => {
    viewport.current?.scrollTo(0, 0);
    viewport.current?.style.setProperty('--code-clip', '0px');
  }, [selected]);

  return (
    <section className="file-panel" aria-label={selected ? `文件内容：${selected}` : '文件内容'}>
      <div className="workbench-drag-region" aria-hidden="true" />
      <div
        className="file-viewport"
        ref={viewport}
        aria-busy={loading}
        onScroll={(event) =>
          event.currentTarget.style.setProperty(
            '--code-clip',
            `${event.currentTarget.scrollLeft}px`,
          )
        }
      >
        {loading ? (
          <div className="viewer-empty">
            <Loader2 size={26} className="spin" />
            <h2>正在读取文件</h2>
          </div>
        ) : error ? (
          <div className="viewer-empty" role="alert">
            <FileCode2 size={30} />
            <h2>无法读取文件</h2>
            <p>{error}</p>
            <button className="secondary-button" onClick={onReload}>
              重新读取
            </button>
          </div>
        ) : !preview ? (
          <div className="viewer-empty">
            <div className="viewer-empty-icon">
              <FolderOpen size={30} strokeWidth={1.3} />
            </div>
            <h2>浏览项目，继续工作</h2>
            <p>
              在左侧选择一个文件，即可在这里预览内容。
              <br />
              右侧终端已进入项目目录。
            </p>
            <div className="viewer-shortcuts">
              <span>代码高亮</span>
              <span>单文件预览</span>
              <span>本地终端</span>
            </div>
          </div>
        ) : preview.kind === 'unsupported' ? (
          <div className="viewer-empty">
            <FileCode2 size={30} />
            <h2>暂不支持预览</h2>
            <p>{preview.reason}</p>
            <small>{formatBytes(preview.size)}</small>
          </div>
        ) : preview.kind === 'image' ? (
          <div className="image-preview">
            <img src={preview.dataURL} alt={preview.path} />
            <span>{preview.path.split('/').pop()}</span>
          </div>
        ) : (
          <div className="code-document" aria-label="只读代码内容">
            <pre className="line-numbers" aria-hidden="true">
              {lines}
            </pre>
            {highlightedHTML !== null ? (
              <div className="code-content" dangerouslySetInnerHTML={{ __html: highlightedHTML }} />
            ) : (
              <pre className="code-content">
                <code>{content || '\n'}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
