import { apiGet, apiPost } from "./client";
import type { ChatMessage, ChatMode, ChatResponse, LlmProvider, ModelCatalog } from "../types";

export function getCloudModels(): Promise<ModelCatalog> {
  return apiGet<ModelCatalog>("/api/llm/models");
}

type SendChatRequest = {
  messages: ChatMessage[];
  provider: LlmProvider;
  model?: string;
};

const CHAT_ENDPOINTS: Record<ChatMode, string> = {
  general: "/api/chat",
  rag: "/api/chat/rag",
  crm: "/api/chat/crm",
};

/** Routes to the right additive endpoint ("/", "/rag", "/crm") for the active chat mode. */
export function sendChat(mode: ChatMode, body: SendChatRequest): Promise<ChatResponse> {
  return apiPost<ChatResponse>(CHAT_ENDPOINTS[mode], body);
}
