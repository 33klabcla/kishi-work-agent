import type { Board, KanbanCommand } from './types';

/**
 * AI が返したコマンド配列をボード状態に適用する（純粋関数）。
 * DB 永続化は API route 側で行う。
 */
export function applyKanbanCommands(board: Board, commands: KanbanCommand[]): Board {
  let current = structuredClone(board);

  for (const cmd of commands) {
    switch (cmd.name) {
      case 'move_task': {
        const { taskId, toColumnId } = cmd.args;
        for (const col of current.columns) {
          const idx = col.tasks.findIndex(t => t.id === taskId);
          if (idx !== -1) {
            const [task] = col.tasks.splice(idx, 1);
            const target = current.columns.find(c => c.id === toColumnId);
            if (target) {
              task.columnId = toColumnId;
              target.tasks.push(task);
            } else {
              col.tasks.splice(idx, 0, task); // rollback
            }
            break;
          }
        }
        break;
      }
      case 'create_task': {
        const { title, columnId, description } = cmd.args;
        const target = current.columns.find(c => c.id === columnId);
        if (target) {
          target.tasks.push({
            id: `tmp-${Date.now()}-${Math.random()}`,
            title,
            description: description ?? null,
            status: 'TODO',
            order: target.tasks.length,
            columnId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }
      case 'update_task': {
        const { taskId, title, description } = cmd.args;
        for (const col of current.columns) {
          const task = col.tasks.find(t => t.id === taskId);
          if (task) {
            if (title !== undefined) task.title = title;
            if (description !== undefined) task.description = description;
            break;
          }
        }
        break;
      }
      case 'delete_task': {
        const { taskId } = cmd.args;
        for (const col of current.columns) {
          const idx = col.tasks.findIndex(t => t.id === taskId);
          if (idx !== -1) {
            col.tasks.splice(idx, 1);
            break;
          }
        }
        break;
      }
    }
  }

  return current;
}
