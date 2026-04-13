import "dotenv/config";

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/** Public API URL with scheme; Railway agents often omit https:// and break fetch. */
function normalizeApiBase(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export const config = {
  apiBase: normalizeApiBase(req("API_BASE_URL", "http://127.0.0.1:3000")),
  internalKey: req("AGENT_INTERNAL_KEY", "dev-agent-key"),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "looper_ai_bot",
};
