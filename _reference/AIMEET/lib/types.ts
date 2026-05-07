export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type Priority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string; // ISO date YYYY-MM-DD
  priority: Priority;
  status: TaskStatus;
  progress: number; // 0..100
  meetingId?: string;
  reminderAt?: string; // ISO datetime
  reminded?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Meeting = {
  id: string;
  title: string;
  date: string; // ISO datetime
  transcript: string;
  summary: string;
  taskIds: string[];
  createdAt: string;
};

export type Report = {
  id: string;
  title: string;
  periodLabel?: string;
  content: string; // markdown
  taskIds: string[];
  meetingIds: string[];
  createdAt: string;
};
