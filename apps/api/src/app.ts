import cors from "cors";
import express from "express";
import { pool } from "./db.js";
import { chatRouter } from "./routes/chat.js";
import { documentsRouter } from "./routes/documents.js";

export const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/chat", chatRouter);
app.use("/api/documents", documentsRouter);

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
