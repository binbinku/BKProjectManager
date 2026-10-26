import { createBundledHighlighter, createSingletonShorthands } from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';

// Load only the grammar being viewed. Both VS Code themes are emitted together,
// so changing appearance updates token colors through CSS without retokenizing.
const languages = {
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  json: () => import('@shikijs/langs/json'),
  html: () => import('@shikijs/langs/html'),
  xml: () => import('@shikijs/langs/xml'),
  vue: () => import('@shikijs/langs/vue'),
  css: () => import('@shikijs/langs/css'),
  markdown: () => import('@shikijs/langs/markdown'),
  bash: () => import('@shikijs/langs/bash'),
  python: () => import('@shikijs/langs/python'),
  rust: () => import('@shikijs/langs/rust'),
  go: () => import('@shikijs/langs/go'),
  java: () => import('@shikijs/langs/java'),
  csharp: () => import('@shikijs/langs/csharp'),
  cpp: () => import('@shikijs/langs/cpp'),
  yaml: () => import('@shikijs/langs/yaml'),
};
type CodeLanguage = keyof typeof languages;
const extensions: Record<string, CodeLanguage> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  vue: 'vue',
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
const createHighlighter = createBundledHighlighter({
  langs: languages,
  themes: {
    'light-plus': () => import('@shikijs/themes/light-plus'),
    'dark-plus': () => import('@shikijs/themes/dark-plus'),
  },
  // Native JavaScript regex keeps the desktop build offline and avoids WASM
  // fetch/evaluation exceptions in the sandboxed renderer's strict CSP.
  engine: () => createJavaScriptRegexEngine(),
});
const { codeToHtml } = createSingletonShorthands(createHighlighter);

export function languageForPath(path: string | null) {
  return path ? extensions[path.split('.').pop()!.toLowerCase()] : undefined;
}
export function languageForFence(name: string) {
  const value = name.toLowerCase();
  return Object.hasOwn(languages, value) ? (value as CodeLanguage) : extensions[value];
}
export function highlightCode(content: string, language: CodeLanguage) {
  return codeToHtml(content, {
    lang: language,
    themes: { light: 'light-plus', dark: 'dark-plus' },
    defaultColor: false,
  });
}
