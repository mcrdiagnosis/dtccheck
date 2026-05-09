"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, MessageCircle, Wrench, Plus, Trash2, MessageSquare, RefreshCw, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  getConversations,
  getConversation,
  createConversation,
  addMessage,
  deleteConversation,
  findOrCreateDtcConversation,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat-storage";

interface ChatPanelProps {
  diagnosticId: string;
  vehicleInfo?: any;
  analysis?: any;
  dtcCode?: string | null;
  open: boolean;
  onClose: () => void;
  onAnalysisUpdate?: (updated: any) => void;
}

export function ChatPanel({
  diagnosticId,
  vehicleInfo,
  analysis,
  dtcCode,
  open,
  onClose,
  onAnalysisUpdate,
}: ChatPanelProps) {
  const t = useTranslations("chat");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showList, setShowList] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingReport, setUpdatingReport] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = () => {
    setConversations(getConversations(diagnosticId));
  };

  useEffect(() => {
    setActiveId(null);
    setMessages([]);
    setShowList(false);
  }, [diagnosticId]);

  useEffect(() => {
    if (!open || !diagnosticId) return;
    loadConversations();
    if (dtcCode) {
      const conv = findOrCreateDtcConversation(diagnosticId, dtcCode);
      setActiveId(conv.id);
      setMessages(conv.messages);
      setShowList(false);
    } else {
      const all = getConversations(diagnosticId);
      if (all.length > 0) {
        setActiveId(all[0].id);
        setMessages(all[0].messages);
      } else {
        handleNewChat();
      }
    }
  }, [open, dtcCode, diagnosticId]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleNewChat = (type: "general" | "dtc" = "general", code?: string) => {
    const conv = createConversation(diagnosticId, type, code);
    setActiveId(conv.id);
    setMessages([]);
    loadConversations();
    setShowList(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = getConversation(id);
    if (conv) {
      setActiveId(id);
      setMessages(conv.messages);
      setShowList(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteConversation(id);
    loadConversations();
    if (activeId === id) {
      const remaining = getConversations(diagnosticId);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
        setMessages(remaining[0].messages);
      } else {
        handleNewChat();
      }
    }
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || loading || !activeId) return;

    const userMsg: ChatMessage = { role: "user", content: text || "📷", image_base64: pendingImage || undefined };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const imageToSend = pendingImage;
    setPendingImage(null);
    setLoading(true);

    try {
      const conv = getConversation(activeId);
      addMessage(activeId, userMsg);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "Analiza esta imagen en el contexto del diagnóstico",
          vehicle_info: vehicleInfo,
          analysis,
          dtc_code: conv?.dtcCode || undefined,
          history: conv?.messages.slice(-10) || [],
          locale: document.documentElement.lang || "es",
          image_base64: imageToSend || undefined,
        }),
      });

      if (!res.ok) throw new Error(t("chatError"));
      const data = await res.json();
      const assistantMsg: ChatMessage = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMsg]);
      addMessage(activeId, assistantMsg);
      loadConversations();
    } catch (err: any) {
      toast.error(err.message || t("sendError"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReport = async () => {
    if (!activeId || !onAnalysisUpdate || messages.length === 0) return;
    setUpdatingReport(true);
    try {
      const conv = getConversation(activeId);
      const chatHistory = conv?.messages || messages;

      const res = await fetch("/api/chat/update-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_info: vehicleInfo,
          current_analysis: analysis,
          chat_history: chatHistory,
          dtc_code: conv?.dtcCode || undefined,
          locale: document.documentElement.lang || "es",
        }),
      });

      if (!res.ok) throw new Error(t("updateError"));
      const data = await res.json();
      onAnalysisUpdate(data.analysis);
      toast.success(t("reportUpdated"));
    } catch (err: any) {
      toast.error(err.message || t("updateErrorFallback"));
    } finally {
      setUpdatingReport(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border z-50 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Wrench className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("title")}</p>
              {dtcCode && <p className="text-xs text-muted-foreground">DTC: {dtcCode}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowList(!showList)} title={t("conversations")}>
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleNewChat()} title={t("newChat")}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showList && (
          <div className="border-b max-h-60 overflow-y-auto">
            <div className="p-2 space-y-1">
              <button
                onClick={() => handleNewChat()}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2 text-primary"
              >
                <Plus className="h-4 w-4" />
                {t("newGeneralChat")}
              </button>
              {conversations.map((conv) => (
                <div key={conv.id} className="flex items-center gap-1">
                  <button
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`flex-1 text-left px-3 py-2 rounded-md text-sm hover:bg-muted truncate ${activeId === conv.id ? "bg-muted font-medium" : ""}`}
                  >
                    <span className="truncate">{conv.title}</span>
                    <span className="text-xs text-muted-foreground ml-1">({conv.messages.length})</span>
                  </button>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">{t("noConversations")}</p>
              )}
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
              <MessageCircle className="h-12 w-12" />
              <p className="text-sm">{t("emptyState")}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                }`}
              >
                {msg.image_base64 && (
                  <img
                    src={`data:image/jpeg;base64,${msg.image_base64}`}
                    alt=""
                    className="max-w-full rounded-lg mb-2 max-h-36 object-cover"
                  />
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {hasUserMessages && onAnalysisUpdate && (
          <div className="px-4 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleUpdateReport}
              disabled={updatingReport}
            >
              {updatingReport ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {updatingReport ? t("updatingReport") : t("updateReport")}
            </Button>
          </div>
        )}

        <div className="p-4 border-t">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                setPendingImage((reader.result as string).split(",")[1]);
              };
              reader.readAsDataURL(file);
              e.target.value = "";
            }}
          />
          {pendingImage && (
            <div className="relative mb-2 inline-block">
              <img
                src={`data:image/jpeg;base64,${pendingImage}`}
                alt=""
                className="h-16 rounded-lg border"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0"
              onClick={() => imageInputRef.current?.click()}
              disabled={loading}
              title={t("attachImage")}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={send} disabled={loading || (!input.trim() && !pendingImage)} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
