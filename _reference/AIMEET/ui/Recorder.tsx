"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onTranscript: (text: string) => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function Recorder({ onTranscript }: Props) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [text, setText] = useState("");
  const [lang, setLang] = useState("vi-VN");
  const recRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    const SR = (typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)) as any;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (ev: any) => {
      let finalAdd = "";
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalAdd += r[0].transcript + " ";
        else interimText += r[0].transcript;
      }
      if (finalAdd) {
        setText((t) => {
          const next = (t + " " + finalAdd).trim();
          onTranscript(next);
          return next;
        });
      }
      setInterim(interimText);
    };
    rec.onerror = () => {};
    rec.onend = () => {
      if (recRef.current?._wantOn) {
        try {
          rec.start();
        } catch {}
      } else setRecording(false);
    };
    recRef.current = rec;
  }, [lang]);

  async function start() {
    try {
      // also capture raw audio for downloadable file (optional)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunks.current = [];
      mr.ondataavailable = (e) => e.data.size && audioChunks.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
    } catch {
      // mic blocked — still attempt STT (may also fail)
    }

    if (recRef.current) {
      recRef.current._wantOn = true;
      try {
        recRef.current.start();
        setRecording(true);
      } catch {}
    }
  }

  function stop() {
    if (recRef.current) {
      recRef.current._wantOn = false;
      try {
        recRef.current.stop();
      } catch {}
    }
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      try {
        mediaRef.current.stop();
      } catch {}
    }
    setRecording(false);
  }

  function clearAll() {
    setText("");
    setInterim("");
    onTranscript("");
    setAudioUrl(null);
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div>
          <label className="label">Ngôn ngữ</label>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value)} disabled={recording}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="ja-JP">日本語</option>
          </select>
        </div>
        <div className="flex-1" />
        {!recording ? (
          <button className="btn-primary" onClick={start} disabled={!supported}>
            ● Bắt đầu ghi
          </button>
        ) : (
          <button className="btn-danger" onClick={stop}>
            ■ Dừng
          </button>
        )}
        <button className="btn-secondary" onClick={clearAll} disabled={recording}>
          Xoá
        </button>
      </div>

      {!supported && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-2 mb-3">
          Trình duyệt không hỗ trợ Web Speech API. Hãy dùng Chrome/Edge, hoặc dán transcript thủ công ở dưới.
        </div>
      )}

      <div>
        <label className="label">Transcript (có thể chỉnh sửa)</label>
        <textarea
          className="input min-h-[180px] font-mono text-sm"
          value={text + (interim ? ` ${interim}` : "")}
          onChange={(e) => {
            setText(e.target.value);
            setInterim("");
            onTranscript(e.target.value);
          }}
          placeholder="Bắt đầu ghi để nhận dạng giọng nói, hoặc dán transcript có sẵn vào đây..."
        />
      </div>

      {audioUrl && (
        <div className="mt-3">
          <label className="label">Bản ghi âm</label>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
