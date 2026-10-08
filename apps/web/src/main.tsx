import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ingestDocuments as ingestDocumentsRequest } from "./api/documents";
import { ChatSessionProvider } from "./context/ChatSessionContext";
import { AppHeader } from "./components/layout/AppHeader";
import { CompanyExplorer } from "./components/companies/CompanyExplorer";
import { ChatPanel } from "./components/chat/ChatPanel";

function App() {
  return (
    <ChatSessionProvider>
      <AppShell />
    </ChatSessionProvider>
  );
}

function AppShell() {
  const [error, setError] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

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

  return (
    <main>
      <AppHeader />
      {error && <p className="error">{error}</p>}
      <CompanyExplorer onError={setError} />
      <ChatPanel ingestStatus={ingestStatus} isIngesting={isIngesting} onIngest={() => void ingestDocuments()} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
