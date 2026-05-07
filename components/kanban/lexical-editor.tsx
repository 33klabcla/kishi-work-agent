'use client';

import { useMemo } from 'react';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import {
  LexicalComposer,
  type InitialConfigType,
} from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';

type Props = {
  initialJson?: string;
  onChange: (json: string, plainText: string) => void;
};

export default function KanbanLexicalEditor({
  initialJson,
  onChange,
}: Props) {
  const initialConfig: InitialConfigType = useMemo(
    () => ({
      namespace: 'KanbanEditor',
      theme: {
        paragraph: 'mb-1 text-[13.5px] leading-relaxed text-white/80',
      },
      onError: (error: Error, _editor: LexicalEditor) => {
        console.error(error);
      },
      editorState: (editor) => {
        if (!initialJson) return;
        try {
          const parsed = editor.parseEditorState(initialJson);
          editor.setEditorState(parsed);
        } catch {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(''));
          root.append(paragraph);
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative min-h-[160px]">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[160px] w-full bg-transparent text-[13.5px] leading-relaxed
                         text-white/80 placeholder:text-white/25 focus:outline-none"
            />
          }
          placeholder={
            <div className="pointer-events-none absolute top-0 left-0 text-[13.5px] text-white/25">
              詳細メモを入力… (Shift+Enter で改行)
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin
          onChange={(editorState: EditorState) => {
            const json = JSON.stringify(editorState.toJSON());
            let plainText = '';
            editorState.read(() => {
              plainText = $getRoot().getTextContent();
            });
            onChange(json, plainText);
          }}
        />
      </div>
    </LexicalComposer>
  );
}
