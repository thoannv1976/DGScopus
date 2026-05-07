import 'server-only';
import { CRITERIA_GROUPS, CriterionGroup, CriterionGroupId, getGroup } from './criteria';
import { CLAUDE_MODEL, claude, extractJson } from './claude';
import type {
  CriterionScore,
  Evaluation,
  GroupEvaluation,
} from './types';

function groupPrompt(group: CriterionGroup, syllabus: string): string {
  const items = group.criteria
    .map((c, idx) => `${idx + 1}. [${c.id}] ${c.text}`)
    .join('\n');

  return `Bạn là một chuyên gia đánh giá đề cương học phần đại học, đóng vai "${group.audience}".
Mục tiêu nhóm tiêu chí: ${group.goal}

Hãy đánh giá ĐỀ CƯƠNG HỌC PHẦN dưới đây theo từng tiêu chí. Với MỖI tiêu chí, hãy:
- Cho điểm 1..5 (1=rất kém, 2=yếu, 3=đạt, 4=tốt, 5=xuất sắc)
- Viết nhận xét ngắn gọn (1-3 câu) bằng tiếng Việt, dẫn chiếu phần liên quan trong đề cương
- Đề xuất 1-3 gợi ý chỉnh sửa cụ thể, có thể hành động được

Sau đó tổng hợp:
- summary: 2-4 câu tổng kết góc nhìn của vai trò này
- prioritizedRevisions: 3-6 nội dung CẦN CHỈNH SỬA, sắp theo mức độ ưu tiên giảm dần

CHỈ TRẢ VỀ JSON (không thêm chữ nào khác), đúng schema sau:
{
  "scores": [
    { "criterionId": "<id>", "score": <int 1..5>, "comment": "<vi>", "suggestions": ["<vi>", ...] }
  ],
  "summary": "<vi>",
  "prioritizedRevisions": ["<vi>", ...]
}

Danh sách tiêu chí cần chấm:
${items}

ĐỀ CƯƠNG HỌC PHẦN:
"""
${syllabus}
"""`;
}

interface RawGroupResult {
  scores: { criterionId: string; score: number; comment: string; suggestions: string[] }[];
  summary: string;
  prioritizedRevisions: string[];
}

async function evaluateGroup(
  groupId: CriterionGroupId,
  syllabus: string,
): Promise<GroupEvaluation> {
  const group = getGroup(groupId);
  const c = claude();
  let resp;
  try {
    resp = await c.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system:
        'Bạn là chuyên gia đảm bảo chất lượng giáo dục đại học Việt Nam. Trả lời chính xác bằng tiếng Việt và CHỈ trả về JSON khi được yêu cầu.',
      messages: [{ role: 'user', content: groupPrompt(group, syllabus) }],
    });
  } catch (e) {
    console.error(`evaluateGroup(${groupId}) failed`, e);
    throw e;
  }

  if (resp.stop_reason === 'max_tokens') {
    throw new Error(
      `Phản hồi của AI cho nhóm "${group.name}" bị cắt do vượt giới hạn token. Vui lòng thử lại.`,
    );
  }

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');

  const raw = extractJson<RawGroupResult>(text);

  const scores: CriterionScore[] = group.criteria.map((c) => {
    const found = raw.scores.find((s) => s.criterionId === c.id);
    return {
      criterionId: c.id,
      criterionText: c.text,
      score: clamp(found?.score ?? 3, 1, 5),
      comment: found?.comment ?? '',
      suggestions: found?.suggestions ?? [],
    };
  });

  const avg =
    scores.reduce((s, x) => s + x.score, 0) / Math.max(1, scores.length);

  return {
    groupId,
    groupName: group.name,
    averageScore: round2(avg),
    scores,
    summary: raw.summary ?? '',
    prioritizedRevisions: raw.prioritizedRevisions ?? [],
  };
}

export async function evaluateSyllabus(syllabus: string): Promise<Evaluation> {
  const groups = await Promise.all(
    CRITERIA_GROUPS.map((g) => evaluateGroup(g.id, syllabus)),
  );
  const overall =
    groups.reduce((s, g) => s + g.averageScore, 0) / groups.length;

  const top: string[] = [];
  for (const g of groups) {
    for (const r of g.prioritizedRevisions.slice(0, 2)) {
      top.push(`[${g.groupName}] ${r}`);
    }
  }

  return {
    overallScore: round2(overall),
    groups,
    topSuggestions: top,
    model: CLAUDE_MODEL,
  };
}

export async function reviseSyllabus(
  syllabus: string,
  evaluation: Evaluation,
  userInstructions?: string,
): Promise<{ revised: string; changeLog: string[] }> {
  const directives = evaluation.groups
    .map((g) => {
      const items = g.prioritizedRevisions
        .map((r, i) => `   ${i + 1}. ${r}`)
        .join('\n');
      return `• Vai trò: ${g.groupName} (điểm TB ${g.averageScore}/5)\n${items}`;
    })
    .join('\n\n');

  const c = claude();
  const resp = await c.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16384,
    system:
      'Bạn là chuyên gia thiết kế đề cương học phần đại học Việt Nam, viết tiếng Việt học thuật, súc tích, đúng cấu trúc.',
    messages: [
      {
        role: 'user',
        content: `Hãy CHỈNH SỬA đề cương học phần dưới đây để khắc phục các vấn đề đã nêu, đồng thời giữ nguyên cấu trúc gốc khi có thể (tên học phần, mã học phần, số tín chỉ, v.v.). Cải thiện CLO, ma trận CLO–PLO, phương pháp đánh giá, học liệu, tỷ trọng đánh giá, rubrics, v.v.

Yêu cầu chỉnh sửa từ kết quả đánh giá:
${directives}

${userInstructions ? `Yêu cầu thêm từ người dùng:\n${userInstructions}\n` : ''}

CHỈ trả về JSON đúng schema:
{
  "revised": "<toàn văn đề cương đã chỉnh sửa, dạng plain text/markdown tiếng Việt>",
  "changeLog": ["<điểm thay đổi 1>", "<điểm thay đổi 2>", ...]
}

ĐỀ CƯƠNG GỐC:
"""
${syllabus}
"""`,
      },
    ],
  });

  if (resp.stop_reason === 'max_tokens') {
    throw new Error(
      'Phản hồi của AI bị cắt do vượt giới hạn token khi viết lại đề cương. Vui lòng thử lại.',
    );
  }

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');

  return extractJson<{ revised: string; changeLog: string[] }>(text);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
