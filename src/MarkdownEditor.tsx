import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';

const colors = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--md-heading)', fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--md-link)' },
  { tag: [tags.monospace, tags.string], color: 'var(--md-string)' },
  { tag: [tags.processingInstruction, tags.meta], color: 'var(--muted)' },
  { tag: tags.comment, color: 'var(--md-comment)' },
  { tag: tags.keyword, color: 'var(--md-heading)' },
]);

export function MarkdownEditor({
  value,
  onChange,
  onSave,
  readOnly,
}: {
  value: string;
  onChange(value: string): void;
  onSave(): void;
  readOnly: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const editable = useRef(new Compartment());
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };
  // The editor owns its document while mounted: keystrokes must not recreate its
  // state, selection or undo history. Returning to read mode unmounts it.
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          bracketMatching(),
          markdown(),
          syntaxHighlighting(colors),
          EditorView.lineWrapping,
          editable.current.of([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          EditorView.contentAttributes.of({
            'aria-label': 'Markdown 源码编辑器',
            spellcheck: 'false',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
          keymap.of([
            {
              key: 'Mod-s',
              run: () => {
                callbacks.current.onSave();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
        ],
      }),
    });
    editor.current = view;
    view.focus();
    return () => {
      editor.current = null;
      view.destroy();
    };
  }, []);
  useEffect(() => {
    editor.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);
  return <div className="markdown-editor" ref={host} />;
}
