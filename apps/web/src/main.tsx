import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import type { ChatMode, Detail } from "./types";
import { ingestDocuments as ingestDocumentsRequest } from "./api/documents";
import { ChatSessionProvider, MODE_COPY, useChatSession } from "./context/ChatSessionContext";
import { useCompanies } from "./hooks/useCompanies";
import { useCloudModels } from "./hooks/useCloudModels";
import { useChat } from "./hooks/useChat";

function App() {
  return (
    <ChatSessionProvider>
      <AppShell />
    </ChatSessionProvider>
  );
}

function AppShell() {
  const { companies, error, selected, selectCompany } = useCompanies();
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const { chatMode, switchChatMode, provider, setProvider, cloudModel, setCloudModel, messages } = useChatSession();
  const { cloudModels } = useCloudModels();
  const { question, setQuestion, isAsking, askQuestion } = useChat();

  // Default to the first free OpenRouter model once the catalog loads, unless
  // a prior choice was already restored from localStorage.
  useEffect(() => {
    if (cloudModels.free.length > 0 && !cloudModel) setCloudModel(cloudModels.free[0].id);
  }, [cloudModels, cloudModel, setCloudModel]);

  async function ingestDocuments() {
    setIsIngesting(true); setIngestStatus("Ingesting documents…");
    try {
      const body = await ingestDocumentsRequest();
      setIngestStatus(body.status === "completed"
        ? `Ingested ${body.documentsProcessed} documents into ${body.chunksCreated} chunks.`
        : `Ingestion failed: ${body.error ?? "unknown error"}`);
    } catch { setIngestStatus("Could not reach the API to ingest documents."); }
    finally { setIsIngesting(false); }
  }

  return <main>
    <header><p className="eyebrow">STAGE 1 · CRM FOUNDATION</p><h1>Customer Compass</h1><p>A small CRM baseline for learning AI architecture.</p></header>
    {error && <p className="error">{error}</p>}
    <section className="layout">
      <aside><h2>Companies</h2>{companies.map(company => <button className={selected?.id === company.id ? "company selected" : "company"} key={company.id} onClick={() => void selectCompany(company.id)}><strong>{company.name}</strong><span>{company.industry} · {company.relationship_status}</span><small>{company.deal_count} deals · {company.interaction_count} interactions</small></button>)}</aside>
      <article>{selected ? <CompanyDetail company={selected} /> : <div className="empty"><h2>Select a company</h2><p>Explore its contacts, deals, and interaction history.</p></div>}</article>
    </section>
    <section className="chat-panel">
      <div>
        <p className="eyebrow">Stage 5 · Realistic CRM RAG</p>
        <h2>Ask Compass</h2>
        <p>Choose a chat mode: general knowledge, document-grounded answers, or the CRM copilot that combines verified database facts with cited documents.</p>
        <div className="rag-controls">
          <button type="button" onClick={() => void ingestDocuments()} disabled={isIngesting}>{isIngesting ? "Ingesting…" : "Ingest documents"}</button>
          <label className="provider-select">
            Chat mode:
            <select value={chatMode} onChange={event => switchChatMode(event.target.value as ChatMode)}>
              <option value="general">{MODE_COPY.general.label}</option>
              <option value="rag">{MODE_COPY.rag.label}</option>
              <option value="crm">{MODE_COPY.crm.label}</option>
            </select>
          </label>
          <label className="provider-select">
            Model:
            <select value={provider} onChange={event => setProvider(event.target.value as "ollama" | "cloud")}>
              <option value="ollama">Local (Ollama · qwen2.5:3b)</option>
              <option value="cloud">Cloud (OpenRouter, free tier)</option>
            </select>
          </label>
          {provider === "cloud" && (
            <label className="provider-select">
              OpenRouter model:
              <select value={cloudModel} onChange={event => setCloudModel(event.target.value)}>
                <optgroup label="Free">
                  {cloudModels.free.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </optgroup>
                {cloudModels.paid.length > 0 && (
                  <optgroup label="Paid (not selectable in this learning app)">
                    {cloudModels.paid.map(m => <option key={m.id} value={m.id} disabled className="paid-option">{m.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
          )}
        </div>
        {ingestStatus && <p className="ingest-status">{ingestStatus}</p>}
      </div>
      <div className="messages">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={index}>
            <p>{message.content}</p>
            {message.role === "assistant" && message.provider && (
              <p className="provider-tag">via {message.provider === "cloud" ? "Cloud (OpenRouter)" : "Local (Ollama)"}</p>
            )}
            {message.scopedCompany && <p className="provider-tag">Scoped to: {message.scopedCompany}</p>}
            {message.facts && (
              <div className="crm-facts">
                <strong>Facts (from CRM database)</strong>
                <p>{message.facts.name} — {message.facts.industry} · {message.facts.relationshipStatus}</p>
                {message.facts.openDeals.length > 0 ? (
                  <ul>
                    {message.facts.openDeals.map(deal => (
                      <li key={deal.id}>{deal.name} · ${Number(deal.amount).toLocaleString()} · expected {deal.expectedCloseDate ?? "not set"}</li>
                    ))}
                  </ul>
                ) : <p>No open deals.</p>}
                <small>{message.facts.wonDealsCount} won · {message.facts.lostDealsCount} lost</small>
              </div>
            )}
            {message.citations && message.citations.length > 0 && (
              <ol className="citations">
                {message.citations.map(citation => (
                  <li key={citation.number}>
                    [{citation.number}] {citation.title}{citation.companyName ? ` · ${citation.companyName}` : ""} ({citation.docType}, similarity {citation.similarity.toFixed(2)})
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={askQuestion}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder={MODE_COPY[chatMode].placeholder} aria-label="Chat question" /><button disabled={isAsking}>{isAsking ? "Thinking…" : "Send"}</button></form>
    </section>
  </main>;
}

function CompanyDetail({ company }: { company: Detail }) {
  return <><div className="detail-heading"><div><p className="eyebrow">{company.relationship_status}</p><h2>{company.name}</h2><p>{company.industry}{company.website && ` · ${company.website}`}</p></div></div>
    <section><h3>Contacts</h3><ul>{company.contacts.map(c => <li key={c.id}><strong>{c.full_name}</strong> — {c.job_title ?? "Contact"}<br /><small>{c.email}</small></li>)}</ul></section>
    <section><h3>Deals</h3>{company.deals.map(d => <div className="card" key={d.id}><strong>{d.name}</strong><span>{d.status} · ${Number(d.amount).toLocaleString()} · expected {d.expected_close_date ?? "not set"}</span></div>)}</section>
    <section><h3>Interactions</h3>{company.interactions.map(i => <div className="card" key={i.id}><strong>{i.subject}</strong><span>{i.interaction_type} · {new Date(i.occurred_at).toLocaleDateString()}</span><p>{i.summary}</p></div>)}</section>
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
