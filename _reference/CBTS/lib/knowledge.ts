import "server-only";
import { adminDb } from "./firebaseAdmin";
import type { KnowledgeEntry, Faq } from "./types";

const MAX_KB_CHARS = 120_000;
const MAX_KB_DOCS = 200;
const MAX_FAQ_DOCS = 200;

/**
 * Build the context block sent to Claude for grounding admissions answers.
 *
 * Strategy: pull every KB + published FAQ entry (capped at MAX_*_DOCS), score
 * them by keyword overlap with the user's question, then emit a context block
 * sorted by score (matches first) but ALWAYS including every entry until we
 * exhaust MAX_KB_CHARS. With our typical KB size this means Claude sees the
 * entire knowledge base on every turn and does the semantic match itself —
 * far more reliable than the naïve substring scorer alone, which routinely
 * misses paraphrases ("lộ trình thăng tiến" vs "cơ hội nghề nghiệp").
 */
export async function buildKnowledgeContext(question: string) {
  const db = adminDb();
  const [kbSnap, faqSnap] = await Promise.all([
    db.collection("knowledge").orderBy("updatedAt", "desc").limit(MAX_KB_DOCS).get(),
    db.collection("faqs").where("published", "==", true).limit(MAX_FAQ_DOCS).get(),
  ]);

  const kb: KnowledgeEntry[] = kbSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KnowledgeEntry, "id">) }));
  const faqs: Faq[] = faqSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Faq, "id">) }));

  const tokens = tokenize(question);
  const scored = [
    ...kb.map((k, i) => ({
      kind: "kb" as const,
      entry: k,
      // Tie-breaker: more recent docs (lower index in the desc-sorted array) win.
      score: scoreText(tokens, `${k.title} ${k.tags?.join(" ") ?? ""} ${k.content}`),
      recencyRank: i,
    })),
    ...faqs.map((f, i) => ({
      kind: "faq" as const,
      entry: f,
      score: scoreText(tokens, `${f.question} ${f.answer}`),
      recencyRank: i,
    })),
  ].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.recencyRank - b.recencyRank;
  });

  let total = 0;
  const blocks: string[] = [];
  const sources: string[] = [];
  for (const item of scored) {
    const block = item.kind === "kb"
      ? `### [KB] ${item.entry.title}${item.entry.category ? ` — ${item.entry.category}` : ""}\n${item.entry.content}`
      : `### [FAQ] ${item.entry.question}\n${item.entry.answer}`;
    if (total + block.length > MAX_KB_CHARS) break;
    blocks.push(block);
    total += block.length;
    sources.push(item.kind === "kb" ? `KB:${item.entry.title}` : `FAQ:${item.entry.question}`);
  }

  if (process.env.DEBUG_KB === "1") {
    console.log(`[KB] question="${question}" tokens=${tokens.length} kb=${kb.length} faqs=${faqs.length} included=${blocks.length} chars=${total}`);
  }

  return { context: blocks.join("\n\n"), sources, debug: { kbCount: kb.length, faqCount: faqs.length, included: blocks.length, chars: total } };
}

function tokenize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function scoreText(tokens: string[], text: string) {
  if (!tokens.length) return 0;
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  let s = 0;
  for (const tok of tokens) if (t.includes(tok)) s += 1;
  return s;
}
