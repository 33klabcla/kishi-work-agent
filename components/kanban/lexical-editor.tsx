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
      theme: {},
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
    [initialJson],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative min-h-[120px] rounded border border-gray-200">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[120px] p-2 text-sm focus:outline-none" />
          }
          placeholder={
            <div className="pointer-events-none absolute top-2 left-2 text-sm text-gray-400">
              詳細を入力…
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