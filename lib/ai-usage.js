import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const LOG_KEY = "huishouden:ai-gebruik";
const MAX_LOG_ENTRIES = 1000;

// Prijzen van het gebruikte model (claude-sonnet-4-6), in USD per 1M tokens.
// Bron: https://platform.claude.com/docs/en/about-claude/pricing (geraadpleegd 2026-07-13)
export const PRIJS_PER_1M_INPUT = 3.0;
export const PRIJS_PER_1M_OUTPUT = 15.0;
// Web-search-tool: $10 per 1000 zoekopdrachten, los van de tokenkosten.
// Bron: https://docs.claude.com/en/docs/about-claude/pricing (geraadpleegd 2026-07-19)
export const PRIJS_PER_ZOEKOPDRACHT = 0.01;

// Logt één AI-aanroep (bron, tokens, kosten) naar Redis. Bewaart alleen de
// meest recente MAX_LOG_ENTRIES om onbeperkte groei te voorkomen.
// Wordt bewust niet ge-awaited door de aanroepers, zodat loggen de reactietijd
// naar de gebruiker niet vertraagt.
export async function logAiGebruik({ bron = "onbekend", inputTokens = 0, outputTokens = 0, webSearches = 0, gebruiker = null }) {
  try {
    const kostenUsd = (inputTokens / 1_000_000) * PRIJS_PER_1M_INPUT
      + (outputTokens / 1_000_000) * PRIJS_PER_1M_OUTPUT
      + webSearches * PRIJS_PER_ZOEKOPDRACHT;
    const huidig = await redis.get(LOG_KEY);
    const lijst = huidig ? (typeof huidig === "string" ? JSON.parse(huidig) : huidig) : [];
    lijst.push({ datum: new Date().toISOString(), bron, inputTokens, outputTokens, webSearches, kostenUsd, gebruiker });
    const bijgesneden = lijst.length > MAX_LOG_ENTRIES ? lijst.slice(lijst.length - MAX_LOG_ENTRIES) : lijst;
    await redis.set(LOG_KEY, JSON.stringify(bijgesneden));
  } catch (e) {
    console.error("AI-gebruik loggen mislukt", e);
  }
}
