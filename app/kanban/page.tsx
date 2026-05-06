'use client';

import { useEffect, useRef, useState } from 'react';

// ---- 型 --------------------------------------------------------------------
type Task = {
  id: string;
  title: string;
  description?: string | null;
  columnId: string;
  order: number;
};

type Column = {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
};

// ---- API ヘルパー ----------------------------------------------------------
async function fetchBoard(): Promise<Column[]> {
  const res = await fetch('/api/kanban/columns');
  const data = await res.json();
  return data.columns;
}

async function createTask(title: string, columnId: string): Promise<void> {
  await fetch('/api/kanban/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, columnId }),
  });
}

async function moveTask(taskId: string, toColumnId: string): Promise<void> {
  await fetch(`/api/kanban/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columnId: toColumnId }),
  });
}

async function deleteTask(taskId: string): Promise<void> {
  await fetch(`/api/kanban/tasks/${taskId}`, { method: 'DELETE' });
}

async function askAi(
  prompt: string,
): Promise<{ message: string; columns: Column[] }> {
  const res = await fetch('/api/kanban/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return res.json();
}

// ---- コンポーネント --------------------------------------------------------
export default function KanbanPage() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [addingTaskCol, setAddingTaskCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dragTask, setDragTask] = useState<{ taskId: string; fromColId: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初期ロード
  useEffect(() => {
    fetchBoard()
      .then(setColumns)
      .finally(() => setLoading(false));
  }, []);

  // タスク追加
  const handleAddTask = async (colId: string) => {
    if (!newTaskTitle.trim()) return;
    await createTask(newTaskTitle.trim(), colId);
    setNewTaskTitle('');
    setAddingTaskCol(null);
    setColumns(await fetchBoard());
  };

  // タスク削除
  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
    setColumns(await fetchBoard());
  };

  // ドラッグ&ドロップ
  const handleDragStart = (taskId: string, fromColId: string) => {
    setDragTask({ taskId, fromColId });
  };

  const handleDrop = async (toColId: string) => {
    if (!dragTask || dragTask.fromColId === toColId) {
      setDragTask(null);
      return;
    }
    await moveTask(dragTask.taskId, toColId);
    setDragTask(null);
    setColumns(await fetchBoard());
  };

  // AI 操作
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setAiLoading(true);
    setAiMessage('');
    try {
      const result = await askAi(prompt.trim());
      setAiMessage(result.message);
      setColumns(result.columns);
      setPrompt('');
    } catch {
      setAiMessage('エラーが発生しました。');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.muted}>ボードを読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <h1 style={styles.title}>Kishi Work Agent — Kanban</h1>
      </header>

      {/* AI チャット入力 */}
      <form onSubmit={handleAiSubmit} style={styles.aiBar}>
        <input
          ref={inputRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="AI に指示: 「海事サイバー資料作成を進行中に移動して」など"
          style={styles.aiInput}
          disabled={aiLoading}
        />
        <button type="submit" style={styles.aiBtn} disabled={aiLoading || !prompt.trim()}>
          {aiLoading ? '処理中...' : '送信'}
        </button>
      </form>

      {/* AI 返答 */}
      {aiMessage && (
        <div style={styles.aiMessage}>
          <span>🤖 {aiMessage}</span>
          <button onClick={() => setAiMessage('')} style={styles.dismissBtn}>✕</button>
        </div>
      )}

      {/* ボード */}
      <div style={styles.board}>
        {columns.length === 0 ? (
          <p style={styles.muted}>
            カラムがありません。<code>pnpm db:push</code> 後に初期データを投入してください。
          </p>
        ) : (
          columns.map(col => (
            <div
              key={col.id}
              style={styles.column}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
            >
              {/* カラムヘッダー */}
              <div style={styles.colHeader}>
                <span style={styles.colName}>{col.name}</span>
                <span style={styles.badge}>{col.tasks.length}</span>
              </div>

              {/* タスク一覧 */}
              <div style={styles.taskList}>
                {col.tasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id, col.id)}
                    style={styles.taskCard}
                  >
                    <span style={styles.taskTitle}>{task.title}</span>
                    {task.description && (
                      <p style={styles.taskDesc}>{task.description}</p>
                    )}
                    {/* カラム移動ボタン */}
                    <div style={styles.taskActions}>
                      {columns
                        .filter(c => c.id !== col.id)
                        .map(c => (
                          <button
                            key={c.id}
                            style={styles.moveBtn}
                            onClick={() => moveTask(task.id, c.id).then(() => fetchBoard().then(setColumns))}
                          >
                            → {c.name}
                          </button>
                        ))}
                      <button
                        style={styles.deleteBtn}
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* タスク追加 */}
              {addingTaskCol === col.id ? (
                <div style={styles.addForm}>
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTask(col.id);
                      if (e.key === 'Escape') setAddingTaskCol(null);
                    }}
                    placeholder="タスク名を入力"
                    style={styles.addInput}
                  />
                  <button style={styles.addConfirmBtn} onClick={() => handleAddTask(col.id)}>追加</button>
                  <button style={styles.cancelBtn} onClick={() => setAddingTaskCol(null)}>✕</button>
                </div>
              ) : (
                <button
                  style={styles.addTaskBtn}
                  onClick={() => {
                    setAddingTaskCol(col.id);
                    setNewTaskTitle('');
                  }}
                >
                  ＋ タスクを追加
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- スタイル ---------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f4f5f7',
    fontFamily: '\'Noto Sans JP\', sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  header: {
    background: '#0e4166',
    color: '#fff',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  aiBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 24px',
    background: '#fff',
    borderBottom: '1px solid #dfe1e6',
  },
  aiInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #c1c7d0',
    fontSize: 14,
    outline: 'none',
  },
  aiBtn: {
    padding: '8px 20px',
    background: '#0052cc',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 600,
  },
  aiMessage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#e3fcef',
    borderLeft: '4px solid #36b37e',
    padding: '10px 24px',
    fontSize: 14,
    color: '#006644',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#006644',
  },
  board: {
    display: 'flex',
    gap: 16,
    padding: 24,
    overflowX: 'auto',
    flex: 1,
    alignItems: 'flex-start',
  },
  column: {
    background: '#ebecf0',
    borderRadius: 8,
    padding: 12,
    minWidth: 260,
    maxWidth: 300,
    flexShrink: 0,
  },
  colHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  colName: {
    fontWeight: 700,
    fontSize: 14,
    color: '#172b4d',
  },
  badge: {
    background: '#dfe1e6',
    borderRadius: 10,
    padding: '1px 8px',
    fontSize: 12,
    color: '#5e6c84',
    fontWeight: 600,
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 8,
  },
  taskCard: {
    background: '#fff',
    borderRadius: 6,
    padding: '10px 12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'grab',
  },
  taskTitle: {
    fontSize: 14,
    color: '#172b4d',
    fontWeight: 500,
    display: 'block',
  },
  taskDesc: {
    fontSize: 12,
    color: '#6b778c',
    marginTop: 4,
    marginBottom: 0,
  },
  taskActions: {
    display: 'flex',
    gap: 4,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  moveBtn: {
    fontSize: 11,
    padding: '2px 8px',
    background: '#deebff',
    color: '#0052cc',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  deleteBtn: {
    fontSize: 12,
    padding: '2px 6px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginLeft: 'auto',
    color: '#97a0af',
  },
  addTaskBtn: {
    marginTop: 8,
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#5e6c84',
    fontSize: 14,
    padding: '6px 4px',
    borderRadius: 4,
  },
  addForm: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  addInput: {
    padding: '8px 10px',
    borderRadius: 4,
    border: '1px solid #0052cc',
    fontSize: 14,
    outline: 'none',
  },
  addConfirmBtn: {
    background: '#0052cc',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: '#5e6c84',
  },
  muted: {
    color: '#6b778c',
    fontSize: 14,
  },
};
