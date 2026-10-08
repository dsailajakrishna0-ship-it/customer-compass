import type { ChatMessage } from "../../types";
import { CrmFactsPanel } from "./CrmFactsPanel";
import { CitationList } from "./CitationList";

/** A single chat bubble: message text, optional provider tag, optional CRM facts panel, optional citations. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`message ${message.role}`}>
      <p>{message.content}</p>
      {message.role === "assistant" && message.provider && (
        <p className="provider-tag">via {message.provider === "cloud" ? "Cloud (OpenRouter)" : "Local (Ollama)"}</p>
      )}
      {message.scopedCompany && <p className="provider-tag">Scoped to: {message.scopedCompany}</p>}
      {message.facts && <CrmFactsPanel facts={message.facts} />}
      {message.citations && message.citations.length > 0 && <CitationList citations={message.citations} />}
    </div>
  );
}
