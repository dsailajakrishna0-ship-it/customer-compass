/**
 * Deterministic, explainable query routing (Stage 5).
 *
 * Decides whether a question needs a structured CRM fact lookup (SQL), a
 * document-retrieval lookup (RAG), both, or — if neither keyword set
 * matches — falls back to RAG-only, preserving the Stage 3 default
 * grounded-chat behavior. The routing is a plain keyword/substring match
 * rather than an LLM call, so it stays fast, free, and trivially observable
 * (log/inspect exactly why a route was chosen) instead of being another
 * opaque model decision.
 *
 * Company scoping (for the "never retrieve another customer's material"
 * acceptance criterion) is detected the same way: by matching a significant
 * word from a known company name against the question text.
 */

import { listCompanies, type CompanyRef } from "../crm/queries.js";

export type QueryRoute = {
  wantsStructured: boolean;
  wantsRag: boolean;
  company: CompanyRef | null;
};

const STRUCTURED_KEYWORDS = [
  "deal",
  "deals",
  "pipeline",
  "amount",
  "value",
  "status of",
  "close date",
  "revenue",
  "won",
  "lost",
  "relationship status",
];

const RAG_KEYWORDS = [
  "said",
  "say",
  "says",
  "mention",
  "discuss",
  "told",
  "email",
  "call",
  "note",
  "conversation",
  "feedback",
  "asked",
  "requested",
  "complain",
];

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

/** Finds the first company whose name is clearly referenced in the question text. */
function findMentionedCompany(question: string, companies: CompanyRef[]): CompanyRef | null {
  const lower = question.toLowerCase();
  for (const company of companies) {
    const significantWords = company.name.split(/\s+/).filter((word) => word.length > 3);
    if (significantWords.some((word) => lower.includes(word.toLowerCase()))) {
      return company;
    }
  }
  return null;
}

export async function classifyQuery(question: string): Promise<QueryRoute> {
  const lower = question.toLowerCase();
  const companies = await listCompanies();
  const company = findMentionedCompany(question, companies);

  const wantsStructured = matchesAny(lower, STRUCTURED_KEYWORDS);
  const wantsRag = matchesAny(lower, RAG_KEYWORDS) || !wantsStructured;

  return { wantsStructured, wantsRag, company };
}
