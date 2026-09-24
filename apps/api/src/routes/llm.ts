import { Router } from "express";

export const llmRouter = Router();

// A couple of well-known paid models shown for reference only, so a learner
// can see what "the same dropdown, but paid" looks like. These are never
// selectable — the UI renders them disabled/greyed out.
const PAID_EXAMPLE_MODEL_IDS = ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4"];

type OpenRouterModel = {
  id: string;
  name: string;
  pricing?: { prompt?: string; completion?: string };
};

type ModelOption = { id: string; name: string };

let cache: { fetchedAt: number; free: ModelOption[]; paid: ModelOption[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Lists OpenRouter's current free-tier models plus a couple of disabled
 * paid examples, so the web UI can offer a live "OpenRouter model" dropdown
 * instead of only the single server-configured OPENROUTER_MODEL default.
 * Cached briefly since OpenRouter's public /models catalog is large and
 * doesn't change second-to-second.
 */
llmRouter.get("/models", async (_request, response) => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return response.json({ free: cache.free, paid: cache.paid });
  }

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/models");
    if (!upstream.ok) {
      throw new Error(`OpenRouter /models returned ${upstream.status}`);
    }
    const payload = (await upstream.json()) as { data?: OpenRouterModel[] };
    const models = payload.data ?? [];

    const free = models
      .filter(m => m.id.endsWith(":free"))
      .map(m => ({ id: m.id, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const paid = models
      .filter(m => PAID_EXAMPLE_MODEL_IDS.includes(m.id))
      .map(m => ({ id: m.id, name: m.name }));

    cache = { fetchedAt: Date.now(), free, paid };
    return response.json({ free, paid });
  } catch (error) {
    console.error("Could not fetch OpenRouter model list", error);
    return response.status(503).json({ error: "Could not reach OpenRouter to list available models." });
  }
});
