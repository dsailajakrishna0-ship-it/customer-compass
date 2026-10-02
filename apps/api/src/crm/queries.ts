/**
 * Parameterized structured CRM queries (Stage 5).
 *
 * These are plain SQL lookups against the relational tables from Stage 1 —
 * no embeddings, no LLM involved. They back the "structured facts" half of
 * the Stage 5 query-routing split (see apps/api/src/chat/router.ts): facts
 * that come from here are already correct and never need a citation, unlike
 * claims retrieved from document chunks.
 */

import { pool } from "../db.js";

export type CompanyRef = { id: number; name: string };

/** All companies, used for company-name detection in query routing. */
export async function listCompanies(): Promise<CompanyRef[]> {
  const result = await pool.query<CompanyRef>("SELECT id, name FROM companies ORDER BY name");
  return result.rows;
}

export type DealFact = {
  id: number;
  name: string;
  amount: string;
  status: string;
  expectedCloseDate: string | null;
};

export async function getOpenDeals(companyId: number): Promise<DealFact[]> {
  const result = await pool.query<{
    id: number;
    name: string;
    amount: string;
    status: string;
    expected_close_date: string | null;
  }>(
    `SELECT id, name, amount::text AS amount, status, expected_close_date::text AS expected_close_date
     FROM deals
     WHERE company_id = $1 AND status = 'open'
     ORDER BY expected_close_date NULLS LAST`,
    [companyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount,
    status: row.status,
    expectedCloseDate: row.expected_close_date,
  }));
}

export type CompanySummary = {
  id: number;
  name: string;
  industry: string;
  relationshipStatus: string;
  openDeals: DealFact[];
  wonDealsCount: number;
  lostDealsCount: number;
};

/** Structured facts about one company: relationship status, open deals, and deal-outcome counts. */
export async function getCompanySummary(companyId: number): Promise<CompanySummary | null> {
  const companyResult = await pool.query<{
    id: number;
    name: string;
    industry: string;
    relationship_status: string;
  }>("SELECT id, name, industry, relationship_status FROM companies WHERE id = $1", [companyId]);
  const company = companyResult.rows[0];
  if (!company) {
    return null;
  }

  const [openDeals, dealCounts] = await Promise.all([
    getOpenDeals(companyId),
    pool.query<{ status: string; count: string }>(
      "SELECT status, COUNT(*)::text AS count FROM deals WHERE company_id = $1 GROUP BY status",
      [companyId],
    ),
  ]);

  const wonDealsCount = Number(dealCounts.rows.find((row) => row.status === "won")?.count ?? 0);
  const lostDealsCount = Number(dealCounts.rows.find((row) => row.status === "lost")?.count ?? 0);

  return {
    id: company.id,
    name: company.name,
    industry: company.industry,
    relationshipStatus: company.relationship_status,
    openDeals,
    wonDealsCount,
    lostDealsCount,
  };
}
