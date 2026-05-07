"use client";
import { useState } from "react";

type Task = {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done" | "cancelled";
  progress: number;
  reminderAt?: string;
};

const STATUS_LABEL: Record<string, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  done: "Hoàn thành",
  cancelled: "Đã huỷ",
};

const STATUS_COLOR: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export default function TaskItem({
  task,
  onChange,
  onDelete,
}: {
  task: Task;
  onChange: (t: Task) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Task>(task);
  const [saving, setSaving] = useState(false);

  async function patch(update: Partial<Task>) {
    setSaving(true);
    const r = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (r.ok) {
      const fresh = await r.json();
      onChange(fresh);
    }
    setSaving(false);
  }

  async function save() {
    await patch({
      title: draft.title,
      description: draft.description,
      assignee: draft.assignee,
      dueDate: draft.dueDate,
      priority: draft.priority,
      status: draft.status,
      progress: draft.progress,
      reminderAt: draft.reminderAt,
    });
    setEditing(false);
  }

  const overdue = task.dueDate && task.status !== "done" && task.status !== "cancelled" && new Date(task.dueDate) < new Date(new Date().toDateString());

  if (editing) {
    return (
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="label">Tiêu đề</label>
            <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Mô tả</label>
            <textarea
              className="input min-h-[80px]"
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Người phụ trách</label>
            <input className="input" value={draft.assignee || ""} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} />
          </div>
          <div>
            <label className="label">Hạn</label>
            <input
              type="date"
              className="input"
              value={draft.dueDate || ""}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Ưu tiên</label>
            <select
              className="input"
              value={draft.priority || "medium"}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value as any })}
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>
          <div>
            <label className="label">Trạng thái</label>
            <select className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}>
              <option value="todo">Chưa làm</option>
              <option value="in_progress">Đang làm</option>
              <option value="done">Hoàn thành</option>
              <option value="cancelled">Đã huỷ</option>
            </select>
          </div>
          <div>
            <label className="label">Tiến độ ({draft.progress}%)</label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.progress}
              onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="label">Nhắc lúc</label>
            <input
              type="datetime-local"
              className="input"
              value={draft.reminderAt ? draft.reminderAt.slice(0, 16) : ""}
              onChange={(e) => setDraft({ ...draft, reminderAt: e.target.value ? new Date(e.target.value).toISOString() : "" })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
            Huỷ
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-4 ${overdue ? "border-red-300" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={(e) => patch({ status: e.target.checked ? "done" : "todo", progress: e.target.checked ? 100 : task.progress })}
          className="mt-1 w-5 h-5"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`font-medium ${task.status === "done" ? "line-through text-slate-400" : ""}`}>{task.title}</h4>
              {task.description && <p className="text-sm text-slate-600 mt-1">{task.description}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setEditing(true)}>
                Sửa
              </button>
              <button className="btn-secondary !px-2 !py-1 text-xs text-red-600" onClick={onDelete}>
                Xoá
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span className={`badge ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
            {task.priority && (
              <span className={`badge ${PRIORITY_COLOR[task.priority]}`}>Ưu tiên: {task.priority}</span>
            )}
            {task.assignee && <span className="badge bg-violet-100 text-violet-700">@{task.assignee}</span>}
            {task.dueDate && (
              <span className={`badge ${overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                Hạn: {task.dueDate}
                {overdue ? " · QUÁ HẠN" : ""}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={task.progress}
              onChange={(e) => onChange({ ...task, progress: Number(e.target.value) })}
              onMouseUp={(e) => patch({ progress: Number((e.target as HTMLInputElement).value) })}
              onTouchEnd={(e) => patch({ progress: Number((e.target as HTMLInputElement).value) })}
              className="flex-1"
            />
            <span className="text-xs w-10 text-right text-slate-600">{task.progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
