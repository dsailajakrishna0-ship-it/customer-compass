import cors from "cors";
import express from "express";
import { pool } from "./db.js";

export const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

type ChatMessage = { role: "user" | "assistant"; content: string };
const systemPrompt = `You are Compass, a helpful assistant inside a CRM learning application.
You do not have access to any CRM customer data yet. Be transparent about that.
Give concise, useful answers and never invent facts, access, or actions.`;
const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11435";
const ollamaModel = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

app.get("/health", async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ status: "ok" });
});

app.get("/api/companies", async (_request, response) => {
  const result = await pool.query(`
    SELECT c.id, c.name, c.industry, c.relationship_status,
           COUNT(DISTINCT d.id)::int AS deal_count,
           COUNT(DISTINCT i.id)::int AS interaction_count
    FROM companies c
    LEFT JOIN deals d ON d.company_id = c.id
    LEFT JOIN interactions i ON i.company_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `);
  response.json(result.rows);
});

app.get("/api/companies/:id", async (request, response) => {
  const companyId = Number(request.params.id);
  if (!Number.isInteger(companyId)) {
    return response.status(400).json({ error: "Company ID must be an integer." });
  }

  const company = await pool.query(
    "SELECT id, name, industry, website, relationship_status FROM companies WHERE id = $1",
    [companyId],
  );
  if (company.rowCount === 0) {
    return response.status(404).json({ error: "Company not found." });
  }

  const [contacts, deals, interactions] = await Promise.all([
    pool.query("SELECT id, full_name, job_title, email FROM contacts WHERE company_id = $1 ORDER BY full_name", [companyId]),
    pool.query("SELECT id, name, amount, status, expected_close_date::text FROM deals WHERE company_id = $1 ORDER BY expected_close_date DESC", [companyId]),
    pool.query("SELECT id, interaction_type, subject, occurred_at, summary FROM interactions WHERE company_id = $1 ORDER BY occurred_at DESC", [companyId]),
  ]);

  return response.json({
    ...company.rows[0],
    contacts: contacts.rows,
    deals: deals.rows,
    interactions: interactions.rows,
  });
});

app.post("/api/chat", async (request, response) => {
  const messages = request.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
    return response.status(400).json({ error: "Send between 1 and 12 chat messages." });
  }
  if (!messages.every((message): message is ChatMessage =>
    (message?.role === "user" || message?.role === "assistant") &&
    typeof message.content === "string" && message.content.trim().length > 0 && message.content.length <= 4_000,
  )) {
    return response.status(400).json({ error: "Each message needs a user/assistant role and non-empty text up to 4,000 characters." });
  }

  try {
    const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        options: { temperature: 0.3, num_predict: 350 },
      }),
    });
    if (!ollamaResponse.ok) {
      console.error("Ollama request failed", await ollamaResponse.text());
      return response.status(502).json({ error: "The local model is not ready. Start Ollama and pull the configured model." });
    }
    const payload = await ollamaResponse.json() as { message?: { content?: string } };
    return response.json({ message: payload.message?.content ?? "I could not generate a response." });
  } catch (error) {
    console.error("Could not reach Ollama", error);
    return response.status(503).json({ error: "Could not reach Ollama at the local model service." });
  }
});
