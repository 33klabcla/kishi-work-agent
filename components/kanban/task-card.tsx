'use client';

import type { Task } from '@/types/kanban';

type Props = {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
};

export default function TaskCard({
  task,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  // Lexical JSON からプレーンテキストを抽出
  const plainText = (() => {
    if (!task.lexicalJson) return task.description ?? '';
    try {
      const state = JSON.parse(task.lexicalJson);
      const texts: string[] = [];
      const walk = (node: Record<string, unknown>) => {
        if (typeof node.text === 'string' && node.text) texts.push(node.text);
        if (Array.isArray(node.children)) {
          (node.children as Record<string, unknown>[]).forEach(walk);
        }
      };
      if (state.root) walk(state.root as Record<string, unknown>);
      return texts.join(' ');
    } catch {
      return task.description ?? '';
    }
  })();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      className="group relative w-full cursor-grab select-none rounded-xl
                 border border-white/[0.06] bg-[#1a1b23] px-3.5 py-3
                 shadow-sm transition-all duration-150
                 hover:border-indigo-500/40
                 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_4px_16px_rgba(0,0,0,0.3)]
                 active:cursor-grabbing active:scale-[0.98] active:opacity-80"
    >
      {/* タイトル */}
      <p className="text-[13.5px] font-medium leading-snug text-white/90 line-clamp-2">
        {task.title}
      </p>

      {/* タグ */}
      {task.taskTags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {task.taskTags.map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none"
              style={{
                backgroundColor: tag.color + '22',
                color: tag.color,
                border: `1px solid ${tag.color}44`,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* 詳細プレビュー */}
      {plainText && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-white/35 line-clamp-2">
          {plainText}
        </p>
      )}

      {/* 更新日 */}
      <p className="mt-2.5 text-right text-[10px] text-white/20">
        {new Date(task.updatedAt).toLocaleDateString('ja-JP', {
          month: 'numeric',
          day: 'numeric',
        })}
      </p>
    </div>
  );
}
