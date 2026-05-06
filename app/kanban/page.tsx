'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const LexicalEditor = dynamic(
  () => import('@/components/kanban/lexical-editor'),
  { ssr: false },
);

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
    await onSave({
      title,
      lexicalJson: lexicalJson || null,
      description: description || null,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('このタスクを削除しますか？')) return;
    await onDelete();
    onClose();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    alert('リンクをコピーしました');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <input
            className="flex-1 border-b border-gray-200 pb-1 text-lg font-semibold focus:border-blue-400 focus:outline-none"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <button
            onClick={onClose}
            className="text-xl leading-none text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-400">
          カラム: {columns.find(c => c.id === task.columnId)?.name ?? '—'}
        </p>

        <div>
          <label className="mb-1 block text-xs text-gray-500">詳細</label>
          <LexicalEditor
            initialJson={task.lexicalJson ?? undefined}
            onChange={(json, plain) => {
              setLexicalJson(json);
              setDescription(plain);
            }}
          />
        </div>

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
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              🔗 リンクをコピー
            </button>
            <button
              disabled={saving}
              onClick={handleSave}
              className="rounded-lg bg-blue-500 px-4 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800">カンバン</h1>

        {boards.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">既存のボードを開く</p>
            {boards.map(b => (
              <button
                key={b.id}
                onClick={() => onSelect(b)}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
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
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="ボード名を入力"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              disabled={!name.trim() || creating}
              onClick={handleCreate}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {creating ? '…' : '作成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    if (!newTitle.trim()) {
      setAdding(false);
      return;
    }
    onAddTask(column.id, newTitle.trim());
    setNewTitle('');
    setAdding(false);
  };

  return (
    <div
      className={`flex w-72 flex-shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50 shadow-sm ${
        over ? 'ring-2 ring-blue-400' : ''
      }`}
      onDragOver={e => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        setOver(false);
        onDropTask(column.id);
      }}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-sm font-semibold text-gray-700">{column.name}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
          {column.tasks.length}
        </span>
      </div>

      <div className="max-h-[calc(100vh-220px)] flex-1 space-y-2 overflow-y-auto p-2">
        {column.tasks.map(task => (
          <div
            key={task.id}
            draggable
            onDragStart={() => onDragStartTask(task)}
            onClick={() => onClickTask(task)}
            className="cursor-grab select-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-all hover:border-blue-300 hover:shadow-md"
          >
            <p className="line-clamp-2 font-medium">{task.title}</p>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                {task.description}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 p-2">
        {adding ? (
          <div className="space-y-1.5">
            <input
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="タスク名を入力"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewTitle('');
                }
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={handleAdd}
                className="flex-1 rounded-lg bg-blue-500 py-1 text-xs text-white hover:bg-blue-600"
              >
                追加
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewTitle('');
                }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded px-1 py-1 text-left text-sm text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-500"
          >
            + タスクを追加
          </button>
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLog, setAiLog] = useState<{ role: 'user' | 'ai'; text: string }[]>(
    [],
  );
  const chatEndRef = useRef<HTMLDivElement>(null);

  const draggingTask = useRef<Task | null>(null);

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
        if (res.ok) {
          setBoards(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const selectBoard = useCallback((b: Board) => {
    setBoard(b);
    const url = new URL(window.location.href);
    url.searchParams.set('board', b.shareId);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const createBoard = async (name: string): Promise<Board> => {
    const res = await fetch('/api/kanban/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  };

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

  const addColumn = async () => {
    const name = prompt('カラム名を入力してください');
    if (!name || !board) return;

    const res = await fetch('/api/kanban/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId: board.id, name }),
    });

    const col: Column = await res.json();
    setBoard(prev =>
      prev ? { ...prev, columns: [...prev.columns, col] } : prev,
    );
  };

  const onDragStart = (task: Task) => {
    draggingTask.current = task;
  };

  const onDropColumn = async (targetColumnId: string) => {
    const task = draggingTask.current;
    if (!task || task.columnId === targetColumnId) return;

    draggingTask.current = null;

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

      if (data.board) {
        setBoard(data.board);
      }

      setAiLog(prev => [
        ...prev,
        { role: 'ai', text: data.reply ?? '完了しました' },
      ]);
    } catch {
      setAiLog(prev => [
        ...prev,
        { role: 'ai', text: 'エラーが発生しました' },
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    alert(`共有リンクをコピーしました！\n${window.location.href}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse text-sm text-gray-400">読み込み中…</div>
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
    <div className="flex min-h-screen flex-col bg-gray-100">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBoard(null);
              window.history.replaceState(null, '', '/kanban');
            }}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            ← ボード一覧
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{board.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
          >
            🔗 <span className="hidden sm:inline">共有リンク</span>
          </button>
          <button
            onClick={addColumn}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
          >
            + カラム追加
          </button>
        </div>
      </header>

      <main className="flex flex-1 gap-4 overflow-x-auto p-4">
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

      <aside className="border-t border-gray-200 bg-white shadow-lg">
        {aiLog.length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-1 px-4 pt-3">
            {aiLog.map((m, i) => (
              <div
                key={i}
                className={`max-w-prose rounded-lg px-3 py-1.5 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-blue-50 text-right text-blue-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        <div className="flex gap-2 p-3">
          <input
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="AI に指示する（例: 「海事講義資料を In Progress に移動して」）"
            value={aiMessage}
            onChange={e => setAiMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAi()}
            disabled={aiLoading}
          />
          <button
            onClick={sendAi}
            disabled={aiLoading || !aiMessage.trim()}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {aiLoading ? '…' : '送信'}
          </button>
        </div>
      </aside>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          columns={board.columns}
          onClose={() => setSelectedTask(null)}
          onSave={async data => {
            await updateTask(selectedTask.id, data);
            setSelectedTask(prev => (prev ? { ...prev, ...data } : prev));
          }}
          onDelete={async () => {
            await deleteTask(selectedTask.id);
          }}
        />
      )}
    </div>
  );
}