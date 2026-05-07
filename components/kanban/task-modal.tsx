'use client';

import { useEffect, useRef, useState } from 'react';
import KanbanLexicalEditor from './lexical-editor';
import type { Tag, Task } from '@/types/kanban';

type Column = { id: string; name: string };

type Props = {
  task: Task;
  columns: Column[];
  allTags: Tag[];
  onClose: () => void;
  onSave: (updated: {
    id: string;
    title: string;
    columnId: string;
    lexicalJson: string;
    description: string;
    tagIds: string[];
  }) => void;
  onDelete: (taskId: string) => void;
  onTagsChange: (tags: Tag[]) => void;
};

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

export default function TaskModal({
  task,
  columns,
  allTags,
  onClose,
  onSave,
  onDelete,
  onTagsChange,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [columnId, setColumnId] = useState(task.columnId);
  const [lexicalJson, setLexicalJson] = useState(task.lexicalJson ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    task.taskTags?.map((tt) => tt.tagId) ?? [],
  );
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagDesc, setNewTagDesc] = useState('');
  const [saved, setSaved] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // ESC で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase()),
  );

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const res = await fetch('/api/kanban/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDesc.trim() || undefined,
      }),
    });
    const created: Tag = await res.json();
    onTagsChange([...allTags, created]);
    setSelectedTagIds((prev) => [...prev, created.id]);
    setNewTagName('');
    setNewTagDesc('');
  };

  const handleSave = () => {
    onSave({
      id: task.id,
      title,
      columnId,
      lexicalJson,
      description,
      tagIds: selectedTagIds,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#task-${task.id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
                 bg-black/70 pt-12 pb-12 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col rounded-2xl
                   border border-white/[0.08] bg-[#0f1014] shadow-2xl"
      >
        {/* ── ヘッダー ── */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトルを入力"
            className="flex-1 bg-transparent text-xl font-semibold text-white/90
                       placeholder:text-white/25 focus:outline-none"
          />
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="mt-0.5 rounded-lg p-1.5 text-white/40 transition
                       hover:bg-white/[0.06] hover:text-white/80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── メタ情報 ── */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2
                        border-b border-white/[0.06] px-6 py-3">
          {/* カラム */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/35">カラム</span>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04]
                         px-2.5 py-1 text-[12px] text-white/80
                         focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 日時 */}
          <span className="text-[11px] text-white/25">
            作成:{' '}
            {new Date(task.createdAt).toLocaleDateString('ja-JP', {
              month: 'numeric', day: 'numeric',
            })}
            　更新:{' '}
            {new Date(task.updatedAt).toLocaleDateString('ja-JP', {
              month: 'numeric', day: 'numeric',
            })}
          </span>
        </div>

        {/* ── タグエリア ── */}
        <div className="border-b border-white/[0.06] px-6 py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-white/35">タグ</span>

            {/* 選択中タグ */}
            {selectedTagIds.map((tagId) => {
              const tag = allTags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full
                             px-2.5 py-0.5 text-[11px] font-medium transition hover:opacity-70"
                  style={{
                    backgroundColor: tag.color + '28',
                    color: tag.color,
                    border: `1px solid ${tag.color}55`,
                  }}
                >
                  {tag.name}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="3">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </span>
              );
            })}

            {/* タグ追加ボタン */}
            <button
              onClick={() => setShowTagPanel((f) => !f)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed
                         border-white/20 px-2.5 py-0.5 text-[11px] text-white/40
                         transition hover:border-indigo-400/60 hover:text-indigo-300"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              タグを追加
            </button>
          </div>

          {/* タグパネル */}
          {showTagPanel && (
            <div className="rounded-xl border border-white/[0.08] bg-[#16171f] p-3 space-y-3">
              {/* 検索 */}
              <input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="タグを検索…"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04]
                           px-3 py-1.5 text-[12px] text-white/80
                           placeholder:text-white/25 focus:outline-none
                           focus:ring-1 focus:ring-indigo-500/50"
              />

              {/* 既存タグ一覧 */}
              <div className="flex flex-wrap gap-1.5">
                {filteredTags.length === 0 && (
                  <p className="text-[11px] text-white/30">タグが見つかりません</p>
                )}
                {filteredTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <span
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      title={tag.description ?? ''}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full
                                 px-2.5 py-0.5 text-[11px] font-medium transition"
                      style={{
                        backgroundColor: tag.color + (selected ? '33' : '11'),
                        color: tag.color,
                        border: `1px solid ${tag.color}${selected ? '88' : '33'}`,
                      }}
                    >
                      {selected && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {tag.name}
                    </span>
                  );
                })}
              </div>

              {/* 新規タグ作成 */}
              <div className="border-t border-white/[0.06] pt-3 space-y-2">
                <p className="text-[11px] text-white/30">新しいタグを作成</p>
                <div className="flex gap-2">
                  <input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    placeholder="タグ名"
                    className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.04]
                               px-3 py-1.5 text-[12px] text-white/80
                               placeholder:text-white/25 focus:outline-none
                               focus:ring-1 focus:ring-indigo-500/50"
                  />
                  <div className="flex items-center gap-1">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        className="h-5 w-5 rounded-full transition"
                        style={{
                          backgroundColor: c,
                          outline: newTagColor === c ? `2px solid ${c}` : 'none',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleCreateTag}
                    className="rounded-lg bg-indigo-500/80 px-3 py-1.5 text-[12px] text-white
                               transition hover:bg-indigo-500 active:scale-95"
                  >
                    作成
                  </button>
                </div>
                <input
                  value={newTagDesc}
                  onChange={(e) => setNewTagDesc(e.target.value)}
                  placeholder="説明（任意）"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04]
                             px-3 py-1.5 text-[12px] text-white/60
                             placeholder:text-white/20 focus:outline-none
                             focus:ring-1 focus:ring-indigo-500/40"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Lexical エディタ ── */}
        <div className="px-6 py-4">
          <p className="mb-2 text-[11px] text-white/35">詳細メモ</p>
          <div className="min-h-[180px] rounded-xl border border-white/[0.06]
                          bg-[#16171f] px-4 py-3">
            <KanbanLexicalEditor
              initialJson={task.lexicalJson ?? undefined}
              onChange={(json, plain) => {
                setLexicalJson(json);
                setDescription(plain.slice(0, 500));
              }}
            />
          </div>
        </div>

        {/* ── フッター ── */}
        <div className="flex items-center justify-between
                        border-t border-white/[0.06] px-6 py-3">
          <button
            onClick={() => onDelete(task.id)}
            className="rounded-lg border border-red-500/20 px-3.5 py-1.5 text-[12px]
                       text-red-400 transition hover:border-red-500/50
                       hover:bg-red-500/10 active:scale-95"
          >
            削除
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-lg
                         border border-white/[0.08] px-3.5 py-1.5 text-[12px]
                         text-white/45 transition hover:border-white/20
                         hover:text-white/75 active:scale-95"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              リンクをコピー
            </button>

            <button
              onClick={handleSave}
              className="rounded-lg bg-indigo-500 px-4 py-1.5 text-[12px] font-medium
                         text-white transition hover:bg-indigo-600 active:scale-95"
            >
              {saved ? '保存しました ✓' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
