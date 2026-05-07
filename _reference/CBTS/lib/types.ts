export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  sources?: string[];
}

export interface Conversation {
  id: string;
  startedAt: number;
  lastMessageAt: number;
  userAgent?: string;
  uid?: string | null;
  topic?: string;
  messageCount: number;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  source?: string;
  fileUrl?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  clickCount: number;
  published: boolean;
  generatedFromConversations?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DailyStat {
  id: string; // YYYY-MM-DD
  conversations: number;
  messages: number;
  faqClicks: number;
}
