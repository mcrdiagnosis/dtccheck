export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image_base64?: string;
}

export interface ChatConversation {
  id: string;
  diagnosticId: string;
  title: string;
  type: "general" | "dtc";
  dtcCode?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "dtccheck_chats";

function getAll(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(chats: ChatConversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function getConversations(diagnosticId: string): ChatConversation[] {
  return getAll().filter((c) => c.diagnosticId === diagnosticId).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getConversation(id: string): ChatConversation | null {
  return getAll().find((c) => c.id === id) || null;
}

export function createConversation(diagnosticId: string, type: "general" | "dtc", dtcCode?: string): ChatConversation {
  const chats = getAll();
  const chat: ChatConversation = {
    id: crypto.randomUUID(),
    diagnosticId,
    title: type === "dtc" && dtcCode ? `DTC: ${dtcCode}` : "Chat general",
    type,
    dtcCode,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  chats.push(chat);
  saveAll(chats);
  return chat;
}

export function addMessage(conversationId: string, message: ChatMessage): ChatConversation {
  const chats = getAll();
  const chat = chats.find((c) => c.id === conversationId);
  if (!chat) throw new Error("Conversation not found");
  chat.messages.push(message);
  chat.updatedAt = new Date().toISOString();
  if (chat.messages.length === 1 && message.role === "user") {
    chat.title = message.content.substring(0, 40) + (message.content.length > 40 ? "..." : "");
  }
  saveAll(chats);
  return chat;
}

export function deleteConversation(id: string) {
  const chats = getAll().filter((c) => c.id !== id);
  saveAll(chats);
}

export function findOrCreateDtcConversation(diagnosticId: string, dtcCode: string): ChatConversation {
  const existing = getAll().find((c) => c.diagnosticId === diagnosticId && c.type === "dtc" && c.dtcCode === dtcCode);
  if (existing) return existing;
  return createConversation(diagnosticId, "dtc", dtcCode);
}
