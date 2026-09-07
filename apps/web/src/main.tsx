import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Company = { id: number; name: string; industry: string; relationship_status: string; deal_count: number; interaction_count: number };
type Detail = Company & { website: string | null; contacts: { id: number; full_name: string; job_title: string | null; email: string }[]; deals: { id: number; name: string; amount: string; status: string; expected_close_date: string | null }[]; interactions: { id: number; interaction_type: string; subject: string; occurred_at: string; summary: string }[] };
type Citation = { number: number; documentId: number; title: string; sourcePath: string; docType: string; companyName: string | null; similarity: number; snippet: string };
type ChatMessage = { role: "user" | "assistant"; content: string; citations?: Citation[] };

const api = "http://localhost:3001";

function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Hello — I’m Compass. At this stage I can chat, but I do not yet have access to CRM data." }]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [useRag, setUseRag] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  useEffect(() => { void loadCompanies(); }, []);
  async function loadCompanies() {
    try { setCompanies(await (await fetch(`${api}/api/companies`)).json()); }
    catch { setError("Could not reach the API. Start PostgreSQL and the API, then refresh."); }
  }
  async function selectCompany(id: number) {
    setSelected(await (await fetch(`${api}/api/companies/${id}`)).json());
  }
  async function ingestDocuments() {
    setIsIngesting(true); setIngestStatus("Ingesting documents…");
    try {
      const response = await fetch(`${api}/api/documents/ingest`, { method: "POST" });
      const body = await response.json() as { documentsProcessed?: number; chunksCreated?: number; status?: string; error?: string };
      setIngestStatus(body.status === "completed"
        ? `Ingested ${body.documentsProcessed} documents into ${body.chunksCreated} chunks.`
        : `Ingestion failed: ${body.error ?? "unknown error"}`);
    } catch { setIngestStatus("Could not reach the API to ingest documents."); }
    finally { setIsIngesting(false); }
  }
  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || isAsking) return;
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history); setQuestion(""); setIsAsking(true);
    try {
      const endpoint = useRag ? "/api/chat/rag" : "/api/chat";
      const response = await fetch(`${api}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-12) }) });
      const body = await response.json() as { message?: string; error?: string; citations?: Citation[] };
      setMessages(current => [...current, { role: "assistant", content: body.message ?? body.error ?? "Something went wrong.", citations: body.citations }]);
    } catch { setMessages(current => [...current, { role: "assistant", content: "I could not reach the API. Check that the local services are running." }]); }
    finally { setIsAsking(false); }
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
        <p className="eyebrow">Stage 3 · Basic RAG</p>
        <h2>Ask Compass</h2>
        <p>Toggle document knowledge to get grounded, cited answers from ingested CRM documents.</p>
        <div className="rag-controls">
          <button type="button" onClick={() => void ingestDocuments()} disabled={isIngesting}>{isIngesting ? "Ingesting…" : "Ingest documents"}</button>
          <label><input type="checkbox" checked={useRag} onChange={event => setUseRag(event.target.checked)} /> Use document knowledge (RAG)</label>
        </div>
        {ingestStatus && <p className="ingest-status">{ingestStatus}</p>}
      </div>
      <div className="messages">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={index}>
            <p>{message.content}</p>
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
      <form onSubmit={askQuestion}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder={useRag ? "Ask about ingested CRM documents…" : "Ask a general question…"} aria-label="Chat question" /><button disabled={isAsking}>{isAsking ? "Thinking…" : "Send"}</button></form>
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
