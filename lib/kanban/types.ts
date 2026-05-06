export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  order: number;
  columnId: string;
  createdAt: string;
  updatedAt: string;
};

export type Column = {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
};

export type Board = {
  columns: Column[];
};

// AI が返すコマンド
export type KanbanCommand =
  | { name: 'move_task'; args: { taskId: string; toColumnId: string } }
  | { name: 'create_task'; args: { title: string; columnId: string; description?: string } }
  | { name: 'update_task'; args: { taskId: string; title?: string; description?: string } }
  | { name: 'delete_task'; args: { taskId: string } };

export type AiKanbanResponse = {
  message: string;
  commands: KanbanCommand[];
};
