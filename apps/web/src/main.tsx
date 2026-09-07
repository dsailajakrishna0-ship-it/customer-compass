import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Company = { id: number; name: string; industry: string; relationship_status: string; deal_count: number; interaction_count: number };
type Detail = Company & { website: string | null; contacts: { id: number; full_name: string; job_title: string | null; email: string }[]; deals: { id: number; name: string; amount: string; status: string; expected_close_date: string | null }[]; interactions: { id: number; interaction_type: string; subject: string; occurred_at: string; summary: string }[] };
type ChatMessage = { role: "user" | "assistant"; content: string };

const api = "http://localhost:3001";

function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Hello — I’m Compass. At this stage I can chat, but I do not yet have access to CRM data." }]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => { void loadCompanies(); }, []);
  async function loadCompanies() {
    try { setCompanies(await (await fetch(`${api}/api/companies`)).json()); }
    catch { setError("Could not reach the API. Start PostgreSQL and the API, then refresh."); }
  }
  async function selectCompany(id: number) {
    setSelected(await (await fetch(`${api}/api/companies/${id}`)).json());
  }
  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || isAsking) return;
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history); setQuestion(""); setIsAsking(true);
    try {
      const response = await fetch(`${api}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-12) }) });
      const body = await response.json() as { message?: string; error?: string };
      setMessages(current => [...current, { role: "assistant", content: body.message ?? body.error ?? "Something went wrong." }]);
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
    <section className="chat-panel"><div><p className="eyebrow">Stage 2 · Local LLM</p><h2>Ask Compass</h2><p>This chat has no CRM retrieval yet.</p></div><div className="messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}>{message.content}</div>)}</div><form onSubmit={askQuestion}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a general question…" aria-label="Chat question" /><button disabled={isAsking}>{isAsking ? "Thinking…" : "Send"}</button></form></section>
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
