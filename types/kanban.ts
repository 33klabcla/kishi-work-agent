export type Tag = {
  id: string;
  name: string;
  color: string;
  description?: string | null;
};

export type TaskTag = {
  id: string;
  tagId: string;
  tag: Tag;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  lexicalJson?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  columnId: string;
  order: number;
  taskTags: TaskTag[];
  createdAt: string;
  updatedAt: string;
};

export type Column = {
  id: string;
  name: string;
  order: number;
  tasks: Task[];
};

export type Board = {
  id: string;
  name: string;
  shareId: string;
  columns: Column[];
};
