'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FIELDS,
  REVIEW_MODES,
  TARGET_TIERS,
  type Field,
  type ReviewMode,
  type TargetTier,
} from '@/lib/constants';

export default function UploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [tier, setTier] = useState<TargetTier>('Q2');
  const [field, setField] = useState<Field>('Engineering');
  const [journalName, setJournalName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ReviewMode>('quick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!title.trim()) throw new Error('Vui lòng nhập tên bài báo.');
      if (!file && pastedText.trim().length < 50) {
        throw new Error('Vui lòng upload file hoặc paste nội dung (≥50 ký tự).');
      }

      // Step 1: upload + parse + sectionize.
      setProgress('Đang upload và parse bài báo...');
      const fd = new FormData();
      fd.append(
        'meta',
        JSON.stringify({
          title: title.trim(),
          targetTier: tier,
          field,
          journalName: journalName.trim() || null,
          pastedText: file ? undefined : pastedText.trim(),
        }),
      );
      if (file) fd.append('file', file);
      const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || 'Upload thất bại.');

      // Step 2: evaluate.
      setProgress(
        mode === 'quick'
          ? 'Đang chạy Quick review (~15s)...'
          : 'Đang chạy Detailed review (~90s)...',
      );
      const evalRes = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: upData.paperId, mode }),
      });
      const evalData = await evalRes.json();
      if (!evalRes.ok) throw new Error(evalData.error || 'Đánh giá thất bại.');

      router.push(`/review/${evalData.evalId}`);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Có lỗi xảy ra.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      <div>
        <label className="label" htmlFor="title">
          Tên bài báo
        </label>
        <input
          id="title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="vd: Deep Reinforcement Learning for Adaptive Bitrate Streaming"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Target tier</label>
          <select
            className="input"
            value={tier}
            onChange={(e) => setTier(e.target.value as TargetTier)}
          >
            {TARGET_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Lĩnh vực</label>
          <select
            className="input"
            value={field}
            onChange={(e) => setField(e.target.value as Field)}
          >
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tên journal (tuỳ chọn)</label>
          <input
            className="input"
            value={journalName}
            onChange={(e) => setJournalName(e.target.value)}
            placeholder="vd: IEEE Trans. Multimedia"
          />
        </div>
      </div>

      <div>
        <label className="label">Upload file (.pdf, .docx, .txt, .md, ≤50MB)</label>
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      </div>

      <div>
        <label className="label">Hoặc paste nội dung</label>
        <textarea
          className="textarea"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste full text bài báo (Abstract → References) ở đây nếu không có file..."
          disabled={!!file}
        />
        {file && (
          <p className="text-xs text-slate-500 mt-1">
            Đang dùng file: <strong>{file.name}</strong>. Bỏ chọn file để paste.
          </p>
        )}
      </div>

      <div>
        <label className="label">Chế độ review</label>
        <div className="flex gap-3">
          {REVIEW_MODES.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? 'btn-primary'
                  : 'btn-secondary'
              }
            >
              {m === 'quick' ? 'Quick (~15s)' : 'Detailed (~90s)'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Quick: điểm tổng + top 3 issues.{' '}
          Detailed: full report + cover letter + related papers + acceptance probability.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}
      {busy && (
        <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-3">
          {progress}
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? 'Đang xử lý...' : 'Bắt đầu review'}
      </button>
    </form>
  );
}
