import TelegramBot from "node-telegram-bot-api";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { config } from "./config.js";
import { buildTools } from "./tools.js";
import { apiGet, apiPost } from "./apiClient.js";

type Session = {
  userId?: string;
  chatHistory: BaseMessage[];
};

const sessions = new Map<string, Session>();

function sessionKey(chatId: number, fromId: number): string {
  return `${chatId}:${fromId}`;
}

function getSession(key: string): Session {
  let s = sessions.get(key);
  if (!s) {
    s = { chatHistory: [] };
    sessions.set(key, s);
  }
  return s;
}

/** E.164-style: strip to digits, 8–15 digits, single leading + (matches app registration). */
function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

async function persistMessage(
  userId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    await apiPost("/v1/conversations/messages", {
      userId,
      channel: "telegram",
      role,
      content,
    });
  } catch {
    /* non-fatal */
  }
}

async function resolveTelegramUser(telegramId: string): Promise<string | undefined> {
  try {
    const u = await apiGet<{ id: string }>(`/v1/users/by-telegram/${telegramId}`);
    return u.id;
  } catch {
    return undefined;
  }
}

async function linkFromContact(telegramId: string, phone: string, name: string): Promise<string> {
  const norm = toE164(phone);
  if (!norm) {
    throw new Error("Phone must be 8–15 digits (include country code, e.g. 1 for US).");
  }
  const r = await apiPost<{ userId: string }>("/v1/users/link-phone", {
    telegramId,
    phoneNumber: norm,
    name,
  });
  return r.userId;
}

async function linkFromDeepLink(token: string): Promise<string | undefined> {
  try {
    const r = await apiGet<{ userId: string }>(
      `/v1/link-tokens/${encodeURIComponent(token)}/resolve`
    );
    return r.userId;
  } catch {
    return undefined;
  }
}

async function runAgent(text: string, session: Session): Promise<string> {
  if (!config.openaiKey) {
    return (
      "Looper agent needs OPENAI_API_KEY to run the AI. " +
      "Set it in apps/agent/.env. Meanwhile you can use the mobile app to book."
    );
  }

  const tools = buildTools({ getUserId: () => session.userId });
  const model = new ChatOpenAI({
    model: config.openaiModel,
    temperature: 0,
    apiKey: config.openaiKey,
  });

  const system = `You are Looper, a concise booking assistant for restaurants, spas, and barbershops.
You call backend tools to search businesses, read availability, create/modify/cancel bookings, and list the user's bookings.
When the user asks what is available, to list businesses, or to book without naming a category, call searchBusinesses and omit the type field so all businesses are returned; only set type if they ask specifically for restaurants, spas, or barbershops. Parse the tool JSON field "businesses" (array); if "note" is present, explain that listings may use broad areas (e.g. Downtown) rather than every city the user names—still offer those businesses.
Always use ISO-8601 times that match getAvailability slot strings when booking.
If the user is vague, ask one short clarifying question.
If userId is not linked yet, ask them to share their phone contact using the keyboard.
Respond in the same language the user writes in (multilingual).
Current linked userId: ${session.userId ?? "none"}.`;

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", system],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = createToolCallingAgent({ llm: model, tools, prompt });
  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: process.env.DEBUG_AGENT === "1",
    maxIterations: 12,
  });

  const result = await executor.invoke({
    input: text,
    chat_history: session.chatHistory,
  });

  const out = String(result.output ?? "");
  session.chatHistory.push(new HumanMessage(text));
  session.chatHistory.push(new AIMessage(out));
  if (session.chatHistory.length > 24) {
    session.chatHistory = session.chatHistory.slice(-24);
  }
  return out;
}

async function main() {
  if (!config.telegramToken) {
    console.error("Set TELEGRAM_BOT_TOKEN in apps/agent/.env");
    process.exit(1);
  }

  const bot = new TelegramBot(config.telegramToken, { polling: true });
  console.log("Telegram bot polling…");

  bot.onText(/^\/start(?:\s+(\S+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromId = msg.from?.id;
    if (!fromId) return;
    const key = sessionKey(chatId, fromId);
    const session = getSession(key);
    const payload = match?.[1]?.trim();

    if (payload) {
      const uid = await linkFromDeepLink(payload);
      if (uid) {
        session.userId = uid;
        await bot.sendMessage(
          chatId,
          "Your Telegram is linked to your Looper account. What would you like to book?"
        );
        return;
      }
    }

    const tid = String(fromId);
    const existing = await resolveTelegramUser(tid);
    if (existing) {
      session.userId = existing;
      await bot.sendMessage(chatId, "Welcome back. What can I help you book or change?");
      return;
    }

    await bot.sendMessage(
      chatId,
      "Welcome to Looper. Share your phone number (contact button) so we can link your bookings, or open the app and tap “Contact via Telegram” to link automatically.",
      {
        reply_markup: {
          keyboard: [[{ text: "Share phone number", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  });

  bot.on("contact", async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from?.id;
    if (!fromId || !msg.contact?.phone_number) return;
    const key = sessionKey(chatId, fromId);
    const session = getSession(key);
    const tid = String(fromId);
    try {
      const name =
        [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Customer";
      session.userId = await linkFromContact(tid, msg.contact.phone_number, name);
      await bot.sendMessage(chatId, "Thanks — your phone is linked. What would you like to do?", {
        reply_markup: { remove_keyboard: true },
      });
    } catch (e) {
      await bot.sendMessage(chatId, `Could not link phone: ${(e as Error).message}`);
    }
  });

  bot.on("message", async (msg) => {
    if (msg.contact) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const fromId = msg.from?.id;
    if (!fromId) return;
    const key = sessionKey(chatId, fromId);
    const session = getSession(key);
    const tid = String(fromId);

    if (!session.userId) {
      const existing = await resolveTelegramUser(tid);
      if (existing) session.userId = existing;
    }

    if (!session.userId) {
      const norm = toE164(msg.text.trim());
      if (norm) {
        try {
          const name =
            [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Customer";
          session.userId = await linkFromContact(tid, norm, name);
          await bot.sendMessage(chatId, "Phone saved. What would you like to book?");
        } catch (e) {
          const err = (e as Error).message;
          await bot.sendMessage(
            chatId,
            `Could not link that number: ${err}\n\n` +
              "Check the agent’s API_BASE_URL (public https) and AGENT_INTERNAL_KEY on Railway. " +
              'Or use “Share phone number” or the app → Contact via Telegram.',
          );
        }
      } else {
        await bot.sendMessage(
          chatId,
          "I need your phone number first. Tap /start, then use “Share phone number”, or type a number with country code (e.g. +19175551234 — digits only, 8–15 after +).",
        );
      }
      return;
    }

    const text = msg.text;
    await persistMessage(session.userId, "user", text);
    try {
      const reply = await runAgent(text, session);
      await bot.sendMessage(chatId, reply);
      await persistMessage(session.userId, "assistant", reply);
    } catch (e) {
      const err = (e as Error).message;
      await bot.sendMessage(chatId, `Sorry, something went wrong: ${err}`);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
