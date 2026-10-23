import { useEffect, useMemo, useRef } from 'react';
import { FileCode2, FolderOpen, Loader2, LockKeyhole } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import yaml from 'highlight.js/lib/languages/yaml';
import type { FilePreview } from './types';

for (const [name, language] of Object.entries({
  javascript,
  typescript,
  json,
  xml,
  css,
  markdown,
  bash,
  python,
  rust,
  go,
  java,
  csharp,
  cpp,
  yaml,
}))
  hljs.registerLanguage(name, language);
const languages: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  xml: 'xml',
  vue: 'xml',
  css: 'css',
  md: 'markdown',
  sh: 'bash',
  zsh: 'bash',
  bash: 'bash',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  cs: 'csharp',
  c: 'cpp',
  h: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  yaml: 'yaml',
  yml: 'yaml',
};
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
  const language = selected ? languages[selected.split('.').pop()!.toLowerCase()] : undefined;
  const content = preview?.kind === 'text' ? preview.content : '';
  const highlighted = useMemo(() => {
    if (!language || content.length > 200_000) return null;
    try {
      return hljs.highlight(content, { language, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  }, [content, language]);
  const lines = useMemo(
    () => Array.from({ length: content.split('\n').length }, (_, index) => index + 1).join('\n'),
    [content],
  );
  useEffect(() => {
    viewport.current?.scrollTo(0, 0);
  }, [selected]);

  return (
    <section className="file-panel" aria-label="文件内容">
      <div className="panel-heading file-heading">
        <span>
          <FileCode2 size={15} />
          <strong>{selected?.split('/').pop() || '文件预览'}</strong>
        </span>
        <span className="read-only">
          <LockKeyhole size={11} />
          只读
        </span>
      </div>
      <div className="file-breadcrumb" title={selected || ''}>
        {selected ? selected.split('/').join('  /  ') : '选择左侧文件，开始浏览项目'}
      </div>
      <div className="file-viewport" ref={viewport} aria-busy={loading}>
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
            {highlighted !== null ? (
              <pre className="code-content">
                <code dangerouslySetInnerHTML={{ __html: highlighted }} />
              </pre>
            ) : (
              <pre className="code-content">
                <code>{content || '\n'}</code>
              </pre>
            )}
          </div>
        )}
      </div>
      <div className="file-status">
        <span>
          {preview?.kind === 'text'
            ? `${content.split('\n').length} 行 · ${preview.encoding.toUpperCase()}`
            : '文件预览'}
        </span>
        <span>
          {preview ? formatBytes(preview.size) : ''}
          {preview?.kind === 'text' && ` · ${language || '纯文本'}`}
        </span>
      </div>
    </section>
  );
}
