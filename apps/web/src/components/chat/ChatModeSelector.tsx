import type { ChatMode, LlmProvider, ModelCatalog } from "../../types";
import { MODE_COPY } from "../../context/ChatSessionContext";

type ChatModeSelectorProps = {
  chatMode: ChatMode;
  onChangeMode: (mode: ChatMode) => void;
  provider: LlmProvider;
  onChangeProvider: (provider: LlmProvider) => void;
  cloudModel: string;
  onChangeCloudModel: (modelId: string) => void;
  cloudModels: ModelCatalog;
  isIngesting: boolean;
  onIngest: () => void;
};

/** Controls row: ingest button, chat-mode dropdown, LLM provider dropdown, and (when cloud is picked) the OpenRouter model dropdown. */
export function ChatModeSelector({
  chatMode,
  onChangeMode,
  provider,
  onChangeProvider,
  cloudModel,
  onChangeCloudModel,
  cloudModels,
  isIngesting,
  onIngest,
}: ChatModeSelectorProps) {
  return (
    <div className="rag-controls">
      <button type="button" onClick={onIngest} disabled={isIngesting}>
        {isIngesting ? "Ingesting…" : "Ingest documents"}
      </button>
      <label className="provider-select">
        Chat mode:
        <select value={chatMode} onChange={(event) => onChangeMode(event.target.value as ChatMode)}>
          <option value="general">{MODE_COPY.general.label}</option>
          <option value="rag">{MODE_COPY.rag.label}</option>
          <option value="crm">{MODE_COPY.crm.label}</option>
        </select>
      </label>
      <label className="provider-select">
        Model:
        <select value={provider} onChange={(event) => onChangeProvider(event.target.value as LlmProvider)}>
          <option value="ollama">Local (Ollama · qwen2.5:3b)</option>
          <option value="cloud">Cloud (OpenRouter, free tier)</option>
        </select>
      </label>
      {provider === "cloud" && (
        <label className="provider-select">
          OpenRouter model:
          <select value={cloudModel} onChange={(event) => onChangeCloudModel(event.target.value)}>
            <optgroup label="Free">
              {cloudModels.free.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </optgroup>
            {cloudModels.paid.length > 0 && (
              <optgroup label="Paid (not selectable in this learning app)">
                {cloudModels.paid.map((m) => (
                  <option key={m.id} value={m.id} disabled className="paid-option">{m.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}
    </div>
  );
}
