import type { PaperSection, } from './types';
import type { SectionKey } from './constants';

// =============================================================================
// Sectionize a Scopus paper by IMRAD heading. Pattern: tách khúc plain-text
// thành các section semantic (abstract / introduction / methods / ...) để có
// thể chunk + parallel-call Claude từng section thay vì gửi nguyên 30 trang.
//
// Heuristic — không cần hoàn hảo:
//   1. Dò line trông giống heading (≤80 chars, viết hoa hoặc Title Case, có
//      thể có số "1.", "2.1.", "II.").
//   2. Match keyword vào enum SectionKey đã biết.
//   3. Mọi text giữa hai heading thuộc heading trước đó.
// Nếu match được < 2 sections → fallback: gộp tất cả vào "introduction" và
// để evaluator xử lý whole-text path.
// =============================================================================

const SECTION_PATTERNS: Array<{ key: SectionKey; pattern: RegExp }> = [
  { key: 'abstract',     pattern: /^\s*(?:\d+[.)]\s*)?abstract\b/i },
  { key: 'introduction', pattern: /^\s*(?:\d+[.)]\s*)?(?:i+\.\s*)?(?:introduction|background)\b/i },
  { key: 'methods',      pattern: /^\s*(?:\d+[.)]\s*)?(?:methodolog(?:y|ies)|methods?|materials?\s*(?:and|&)\s*methods?|experimental(?:\s*setup)?|study\s*design)\b/i },
  { key: 'results',      pattern: /^\s*(?:\d+[.)]\s*)?(?:results?|findings?|experimental\s*results?)\b/i },
  { key: 'discussion',   pattern: /^\s*(?:\d+[.)]\s*)?(?:discussion|analysis)\b/i },
  { key: 'conclusion',   pattern: /^\s*(?:\d+[.)]\s*)?(?:conclusions?|concluding\s*remarks?|summary)\b/i },
  { key: 'references',   pattern: /^\s*(?:\d+[.)]\s*)?(?:references?|bibliography|cited\s*works?)\b/i },
];

function detectSection(line: string): SectionKey | null {
  // Heuristic heading: dòng ngắn, không kết thúc bằng dấu chấm (paragraph).
  if (line.length === 0 || line.length > 80) return null;
  if (/[.!?,:;]\s*$/.test(line) && !/^\s*\d+[.)]/.test(line)) return null;
  for (const { key, pattern } of SECTION_PATTERNS) {
    if (pattern.test(line)) return key;
  }
  return null;
}

export function sectionizePaper(text: string): PaperSection[] {
  const lines = text.split(/\r?\n/);
  const sections: Array<{ key: SectionKey; heading: string; lines: string[] }> = [];

  for (const raw of lines) {
    const line = raw.trim();
    const detected = detectSection(line);
    if (detected) {
      // Tránh duplicate cùng key liên tiếp (vd: "Abstract" rồi "Abstract" trong header).
      if (sections.length && sections[sections.length - 1].key === detected) continue;
      sections.push({ key: detected, heading: line, lines: [] });
    } else if (sections.length) {
      sections[sections.length - 1].lines.push(raw);
    }
    // Bỏ qua line trước khi gặp heading đầu tiên (thường là metadata: tên,
    // affiliation, email...) — không thuộc body.
  }

  if (sections.length < 2) {
    // Fallback: gom toàn văn vào introduction để evaluator chạy whole-text.
    return [
      {
        key: 'introduction',
        heading: 'Whole document (no IMRAD headings detected)',
        text: text.trim(),
      },
    ];
  }

  return sections.map((s) => ({
    key: s.key,
    heading: s.heading,
    text: s.lines.join('\n').trim(),
  }));
}

/**
 * Lấy section theo key — trả null nếu không có. Tiện cho prompt builder cần
 * Abstract/Intro/Conclusion (quick mode).
 */
export function findSection(
  sections: PaperSection[],
  key: SectionKey,
): PaperSection | null {
  return sections.find((s) => s.key === key) ?? null;
}
