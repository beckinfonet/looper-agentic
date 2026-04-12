import "dotenv/config";

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  apiBase: req("API_BASE_URL", "http://127.0.0.1:3000").replace(/\/$/, ""),
  internalKey: req("AGENT_INTERNAL_KEY", "dev-agent-key"),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "YourBot",
};
