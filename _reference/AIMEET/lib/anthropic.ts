import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  _client = new Anthropic({ apiKey });
  return _client;
}

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

export type ExtractedTask = {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string; // ISO date
  priority?: "low" | "medium" | "high";
};

const EXTRACT_SYSTEM = `Bạn là trợ lý AI chuyên trích xuất công việc (action items) từ biên bản cuộc họp tiếng Việt/Anh.
Đọc transcript và trả về JSON đúng schema sau, KHÔNG kèm văn bản khác:
{
  "summary": "Tóm tắt cuộc họp 3-5 câu",
  "tasks": [
    {
      "title": "Tiêu đề công việc ngắn gọn",
      "description": "Mô tả chi tiết",
      "assignee": "Người phụ trách (hoặc null)",
      "dueDate": "YYYY-MM-DD (hoặc null nếu không rõ)",
      "priority": "low" | "medium" | "high"
    }
  ]
}
Nếu không có công việc, trả mảng rỗng. Suy luận hợp lý dueDate dựa vào ngữ cảnh ('thứ 2 tới', 'cuối tuần', 'tuần sau'...). Hôm nay là ${new Date().toISOString().slice(0, 10)}.`;

export async function extractTasksFromTranscript(transcript: string): Promise<{
  summary: string;
  tasks: ExtractedTask[];
}> {
  const client = getAnthropic();
  const today = new Date().toISOString().slice(0, 10);
  const sys = EXTRACT_SYSTEM.replace("${new Date().toISOString().slice(0, 10)}", today);

  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: sys,
    messages: [{ role: "user", content: `Transcript:\n\n${transcript}` }],
  });
  const text = resp.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  const jsonText = extractJson(text);
  try {
    const parsed = JSON.parse(jsonText);
    return {
      summary: String(parsed.summary || ""),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch (e) {
    return { summary: text.slice(0, 800), tasks: [] };
  }
}

export async function generateReport(opts: {
  meetings?: { title?: string; summary?: string; date?: string }[];
  tasks: {
    title: string;
    status: string;
    assignee?: string;
    dueDate?: string;
    priority?: string;
    description?: string;
    progress?: number;
  }[];
  periodLabel?: string;
}): Promise<string> {
  const client = getAnthropic();
  const sys = `Bạn là trợ lý AI viết báo cáo công việc chuyên nghiệp bằng tiếng Việt.
Dựa vào danh sách công việc & tóm tắt cuộc họp được cung cấp, hãy soạn BÁO CÁO TỔNG HỢP CÔNG VIỆC có cấu trúc rõ ràng:

1. Tổng quan
2. Tiến độ tổng thể (số liệu: tổng số việc, đã xong, đang làm, quá hạn, % hoàn thành)
3. Công việc nổi bật theo người phụ trách
4. Công việc quá hạn / sắp đến hạn
5. Đề xuất hành động kế tiếp

Trả về Markdown sạch, không kèm code fence.`;

  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: sys,
    messages: [
      {
        role: "user",
        content: `Kỳ báo cáo: ${opts.periodLabel || "Tổng hợp"}\n\nDữ liệu cuộc họp:\n${JSON.stringify(
          opts.meetings || [],
          null,
          2,
        )}\n\nDanh sách công việc:\n${JSON.stringify(opts.tasks, null, 2)}`,
      },
    ],
  });
  return resp.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}
