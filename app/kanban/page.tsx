'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
type Task = {
  id: string;
  title: string;
  description: string | null;
  lexicalJson: string | null;
  order: number;
  columnId: string;
};

type Column = {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
};

type Board = {
  id: string;
  name: string;
  shareId: string;
  columns: Column[];
};

// ---------------------------------------------------------------------------
// Lexical の動的インポート（SSR 回避）
// ---------------------------------------------------------------------------
let LexicalComposer: React.ComponentType<{
  initialConfig: Record<string, unknown>;
  children: React.ReactNode;
}> | null = null;

let LexicalContentEditable: React.ComponentType<{
  className?: string;
}> | null = null;

let LexicalRichTextPlugin: React.ComponentType<{
  contentEditable: React.ReactElement;
  placeholder: React.ReactElement;
  ErrorBoundary: React.ComponentType<{ children: React.ReactNode; onError: (e: Error) => void }>;
}> | null = null;

let LexicalOnChangePlugin: React.ComponentType<{
  onChange: (editorState: unknown) => void;
}> | null = null;

let LexicalHistoryPlugin: React.ComponentType<Record<string, never>> | null = null;

let lexicalLoaded = false;

// ---------------------------------------------------------------------------
// Lexical エディタコンポーネント
// ---------------------------------------------------------------------------
function LexicalEditor({
  initialJson,
  onChange,
}: {
  initialJson?: string;
  onChange: (json: string, plainText: string) => void;
}) {
  const [loaded, setLoaded] = useState(lexicalLoaded);

  useEffect(() => {
    if (lexicalLoaded) {
      setLoaded(true);
      return;
    }
    Promise.all([
      import('@lexical/react/LexicalComposer'),
      import('@lexical/react/LexicalContentEditable'),
      import('@lexical/react/LexicalRichTextPlugin'),
      import('@lexical/react/LexicalOnChangePlugin'),
      import('@lexical/react/LexicalHistoryPlugin'),
    ]).then(([c, ce, rtp, ocp, hp]) => {
      LexicalComposer = c.LexicalComposer;
      LexicalContentEditable = ce.ContentEditable;
      LexicalRichTextPlugin = rtp.RichTextPlugin;
      LexicalOnChangePlugin = ocp.OnChangePlugin;
      LexicalHistoryPlugin = hp.HistoryPlugin;
      lexicalLoaded = true;
      setLoaded(true);
    });
  }, []);

  if (!loaded ||
    !LexicalComposer ||
    !LexicalContentEditable ||
    !LexicalRichTextPlugin ||
    !LexicalOnChangePlugin ||
    !LexicalHistoryPlugin
  ) {
    return (
      <textarea
        className="w-full min-h-[120px] p-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="詳細を入力…"
        defaultValue=""
        onChange={e => onChange('', e.target.value)}
      />
    );
  }

  const C = LexicalComposer!;
  const CE = LexicalContentEditable!;
  const RT = LexicalRichTextPlugin!;
  const OC = LexicalOnChangePlugin!;
  const HP = LexicalHistoryPlugin!;

  const initialEditorState = initialJson
    ? (editor: unknown) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed = (editor as any).parseEditorState(initialJson);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editor as any).setEditorState(parsed);
        } catch {
          // ignore parse errors
        }
      }
    : undefined;

  return (
    <C
      initialConfig={{
        namespace: 'KanbanEditor',
        theme: {},
        onError: (e: Error) => console.error(e),
        editorState: initialEditorState,
      }}
    >
      <div className="relative border border-gray-200 rounded min-h-[120px]">
        <RT
          contentEditable={
            <CE className="min-h-[120px] p-2 text-sm focus:outline-none" />
          }
          placeholder={
            <div className="absolute top-2 left-2 text-gray-400 text-sm pointer-events-none">
              詳細を入力…
            </div>
          }
          ErrorBoundary={({ children }: { children: React.ReactNode; onError: (e: Error) => void }) =>
            <>{children}</>
          }
        />
        <OC
          onChange={(editorState: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const es = editorState as any;
            const json = JSON.stringify(es);
            let plain = '';
            es.read(() => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { $getRoot } = require('lexical') as any;
                plain = $getRoot().getTextContent();
              } catch {
                plain = '';
              }
            });
            onChange(json, plain);
          }}
        />
        <HP />
      </div>
    </C>
  );
}

// ---------------------------------------------------------------------------
// タスク詳細モーダル
// ---------------------------------------------------------------------------
function TaskModal({
  task,
  columns,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  columns: Column[];
  onClose: () => void;
  onSave: (updated: Partial<Task>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [lexicalJson, setLexicalJson] = useState(task.lexicalJson ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ title, lexicalJson: lexicalJson || null, description: description || null });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('このタスクを削除しますか？')) return;
    await onDelete();
    onClose();
  };

  // コピーリンクは親ページの URL をそのまま使う（ボードの shareId が入っている）
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('リンクをコピーしました');
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2">
          <input
            className="flex-1 text-lg font-semibold border-b border-gray-200 pb-1 focus:outline-none focus:border-blue-400"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ✕
          </button>
        </div>

        {/* カラム表示 */}
        <p className="text-xs text-gray-400">
          カラム: {columns.find(c => c.id === task.columnId)?.name ?? '—'}
        </p>

        {/* Lexical エディタ */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">詳細</label>
          <LexicalEditor
            initialJson={task.lexicalJson ?? undefined}
            onChange={(json, plain) => {
              setLexicalJson(json);
              setDescription(plain);
            }}
          />
        </div>

        {/* フッターボタン */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleDelete}
            className="text-sm text-red-500 hover:underline"
          >
            削除
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              🔗 リンクをコピー
            </button>
            <button
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ボード選択 / 作成モーダル
// ---------------------------------------------------------------------------
function BoardSelector({
  boards,
  onSelect,
  onCreate,
}: {
  boards: Board[];
  onSelect: (b: Board) => void;
  onCreate: (name: string) => Promise<Board>;
}) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const b = await onCreate(name.trim());
    onSelect(b);
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">カンバン</h1>

        {boards.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">既存のボードを開く</p>
            {boards.map(b => (
              <button
                key={b.id}
                onClick={() => onSelect(b)}
                className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <span className="font-medium text-gray-800">{b.name}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {b.columns.reduce((n, c) => n + c.tasks.length, 0)} タスク
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-gray-500">新しいボードを作成</p>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="ボード名を入力"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              disabled={!name.trim() || creating}
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {creating ? '…' : '作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインページ
// ---------------------------------------------------------------------------
export default function KanbanPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // AI チャット
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLog, setAiLog] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // D&D
  const draggingTask = useRef<Task | null>(null);

  // ------------------------------------------------------------------
  // URL の shareId からボードを復元
  // ------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('board');

    const load = async () => {
      setLoading(true);
      try {
        if (shareId) {
          const res = await fetch(`/api/kanban/boards?shareId=${shareId}`);
          if (res.ok) {
            const b: Board = await res.json();
            setBoard(b);
            setLoading(false);
            return;
          }
        }
        const res = await fetch('/api/kanban/boards');
        if (res.ok) setBoards(await res.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ------------------------------------------------------------------
  // ボード選択後に URL を更新（リンク共有用）
  // ------------------------------------------------------------------
  const selectBoard = useCallback((b: Board) => {
    setBoard(b);
    const url = new URL(window.location.href);
    url.searchParams.set('board', b.shareId);
    window.history.replaceState(null, '', url.toString());
  }, []);

  // ------------------------------------------------------------------
  // ボード作成
  // ------------------------------------------------------------------
  const createBoard = async (name: string): Promise<Board> => {
    const res = await fetch('/api/kanban/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  };

  // ------------------------------------------------------------------
  // タスク追加
  // ------------------------------------------------------------------
  const addTask = async (columnId: string, title: string) => {
    const res = await fetch('/api/kanban/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId, title }),
    });
    const newTask: Task = await res.json();
    setBoard(prev =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map(c =>
              c.id === columnId ? { ...c, tasks: [...c.tasks, newTask] } : c,
            ),
          }
        : prev,
    );
  };

  // ------------------------------------------------------------------
  // タスク更新
  // ------------------------------------------------------------------
  const updateTask = async (id: string, data: Partial<Task>) => {
    await fetch(`/api/kanban/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setBoard(prev =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map(c => ({
              ...c,
              tasks: c.tasks.map(t => (t.id === id ? { ...t, ...data } : t)),
            })),
          }
        : prev,
    );
  };

  // ------------------------------------------------------------------
  // タスク削除
  // ------------------------------------------------------------------
  const deleteTask = async (id: string) => {
    await fetch(`/api/kanban/tasks/${id}`, { method: 'DELETE' });
    setBoard(prev =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map(c => ({
              ...c,
              tasks: c.tasks.filter(t => t.id !== id),
            })),
          }
        : prev,
    );
  };

  // ------------------------------------------------------------------
  // カラム追加
  // ------------------------------------------------------------------
  const addColumn = async () => {
    const name = prompt('カラム名を入力してください');
    if (!name || !board) return;
    const res = await fetch('/api/kanban/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId: board.id, name }),
    });
    const col: Column = await res.json();
    setBoard(prev => prev ? { ...prev, columns: [...prev.columns, col] } : prev);
  };

  // ------------------------------------------------------------------
  // D&D
  // ------------------------------------------------------------------
  const onDragStart = (task: Task) => {
    draggingTask.current = task;
  };

  const onDropColumn = async (targetColumnId: string) => {
    const task = draggingTask.current;
    if (!task || task.columnId === targetColumnId) return;
    draggingTask.current = null;
    // 楽観的更新
    setBoard(prev =>
      prev
        ? {
            ...prev,
            columns: prev.columns.map(c => ({
              ...c,
              tasks:
                c.id === targetColumnId
                  ? [...c.tasks, { ...task, columnId: targetColumnId }]
                  : c.tasks.filter(t => t.id !== task.id),
            })),
          }
        : prev,
    );
    await fetch(`/api/kanban/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId: targetColumnId }),
    });
  };

  // ------------------------------------------------------------------
  // AI チャット送信
  // ------------------------------------------------------------------
  const sendAi = async () => {
    if (!aiMessage.trim() || !board) return;
    const msg = aiMessage.trim();
    setAiMessage('');
    setAiLog(prev => [...prev, { role: 'user', text: msg }]);
    setAiLoading(true);

    try {
      const res = await fetch('/api/kanban/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: board.id, message: msg }),
      });
      const data = await res.json();
      if (data.board) setBoard(data.board);
      setAiLog(prev => [...prev, { role: 'ai', text: data.reply ?? '完了しました' }]);
    } catch {
      setAiLog(prev => [...prev, { role: 'ai', text: 'エラーが発生しました' }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // ------------------------------------------------------------------
  // リンクコピー
  // ------------------------------------------------------------------
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('共有リンクをコピーしました！\n' + window.location.href);
  };

  // ------------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">読み込み中…</div>
      </div>
    );
  }

  if (!board) {
    return (
      <BoardSelector
        boards={boards}
        onSelect={selectBoard}
        onCreate={createBoard}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBoard(null);
              window.history.replaceState(null, '', '/kanban');
            }}
            className="text-gray-400 hover:text-gray-700 text-sm"
          >
            ← ボード一覧
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{board.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🔗 <span className="hidden sm:inline">共有リンク</span>
          </button>
          <button
            onClick={addColumn}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            + カラム追加
          </button>
        </div>
      </header>

      {/* ボード本体 */}
      <main className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {board.columns.map(col => (
          <ColumnCard
            key={col.id}
            column={col}
            onDropTask={onDropColumn}
            onDragStartTask={onDragStart}
            onAddTask={addTask}
            onClickTask={setSelectedTask}
          />
        ))}
      </main>

      {/* AI チャット */}
      <aside className="bg-white border-t border-gray-200 shadow-lg">
        {/* ログエリア（折りたたみ）*/}
        {aiLog.length > 0 && (
          <div className="max-h-40 overflow-y-auto px-4 pt-3 space-y-1">
            {aiLog.map((m, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-1.5 rounded-lg max-w-prose ${
                  m.role === 'user'
                    ? 'bg-blue-50 text-blue-800 ml-auto text-right'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
        {/* 入力エリア */}
        <div className="flex gap-2 p-3">
          <input
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="AI に指示する（例: 「海事講義資料を In Progress に移動して」）"
            value={aiMessage}
            onChange={e => setAiMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAi()}
            disabled={aiLoading}
          />
          <button
            onClick={sendAi}
            disabled={aiLoading || !aiMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {aiLoading ? '…' : '送信'}
          </button>
        </div>
      </aside>

      {/* タスク詳細モーダル */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          columns={board.columns}
          onClose={() => setSelectedTask(null)}
          onSave={async data => {
            await updateTask(selectedTask.id, data);
            setSelectedTask(prev => prev ? { ...prev, ...data } : prev);
          }}
          onDelete={async () => deleteTask(selectedTask.id)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// カラムカード
// ---------------------------------------------------------------------------
function ColumnCard({
  column,
  onDropTask,
  onDragStartTask,
  onAddTask,
  onClickTask,
}: {
  column: Column;
  onDropTask: (colId: string) => void;
  onDragStartTask: (task: Task) => void;
  onAddTask: (colId: string, title: string) => void;
  onClickTask: (task: Task) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [over, setOver] = useState(false);

  const handleAdd = () => {
    if (!newTitle.trim()) { setAdding(false); return; }
    onAddTask(column.id, newTitle.trim());
    setNewTitle('');
    setAdding(false);
  };

  return (
    <div
      className={`flex-shrink-0 w-72 flex flex-col rounded-xl ${
        over ? 'ring-2 ring-blue-400' : ''
      } bg-gray-50 border border-gray-200 shadow-sm`}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDropTask(column.id); }}
    >
      {/* カラムヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="font-semibold text-sm text-gray-700">{column.name}</span>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {column.tasks.length}
        </span>
      </div>

      {/* タスク一覧 */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        {column.tasks.map(task => (
          <div
            key={task.id}
            draggable
            onDragStart={() => onDragStartTask(task)}
            onClick={() => onClickTask(task)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-grab hover:shadow-md hover:border-blue-300 transition-all text-sm text-gray-800 select-none"
          >
            <p className="font-medium line-clamp-2">{task.title}</p>
            {task.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* タスク追加エリア */}
      <div className="p-2 border-t border-gray-100">
        {adding ? (
          <div className="space-y-1.5">
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="タスク名を入力"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={handleAdd}
                className="flex-1 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                追加
              </button>
              <button
                onClick={() => { setAdding(false); setNewTitle(''); }}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-left text-sm text-gray-400 hover:text-blue-500 px-1 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            + タスクを追加
          </button>
        )}
      </div>
    </div>
  );
}
