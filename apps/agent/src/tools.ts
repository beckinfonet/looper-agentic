import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { apiGet, apiPost } from "./apiClient.js";

type SearchInput = {
  type?: "restaurant" | "spa" | "barbershop";
  location?: string;
  preferences?: string[];
};

function normalizeSearchBody(raw: Record<string, unknown>): SearchInput {
  let type: SearchInput["type"];
  const rawType = raw.type;
  if (typeof rawType === "string") {
    const t = rawType.trim().toLowerCase();
    type = t === "restaurant" || t === "spa" || t === "barbershop" ? t : undefined;
  } else {
    type = undefined;
  }

  let location: string | undefined;
  if (typeof raw.location === "string" && raw.location.trim()) {
    location = raw.location.trim();
  }

  let preferences: string[] | undefined;
  const p = raw.preferences;
  if (Array.isArray(p)) {
    preferences = p.map(String).filter(Boolean);
  } else if (typeof p === "string" && p.trim()) {
    preferences = [p.trim()];
  }

  const out: SearchInput = {};
  if (type) out.type = type;
  if (location) out.location = location;
  if (preferences?.length) out.preferences = preferences;
  return out;
}

function stripEmptyOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function toOptionalPartySize(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function buildTools(ctx: { getUserId: () => string | undefined }) {
  return [
    new DynamicStructuredTool({
      name: "searchBusinesses",
      description:
        "List or search businesses. Each business includes hours (array of {dayOfWeek 0=Sun..6=Sat, open, close}), description, location. Response has businesses array and optional note. preferences: array of strings or omit.",
      schema: z.object({
        type: z.enum(["restaurant", "spa", "barbershop"]).optional(),
        location: z.string().optional(),
        preferences: z.union([z.array(z.string()), z.string()]).optional(),
      }),
      func: async (input) => {
        const raw = { ...input } as Record<string, unknown>;
        if (typeof raw.preferences === "string") raw.preferences = [raw.preferences];
        const body = normalizeSearchBody(raw);
        const r = await apiPost<{ businesses: unknown[]; note?: string }>(
          "/v1/agent/search-businesses",
          body,
        );
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "getAvailability",
      description:
        "Get available time slots for a business on a date. date must be YYYY-MM-DD. businessId is the id string from searchBusinesses.",
      schema: z.object({
        businessId: z.string().describe("Business id from search results"),
        date: z.string().describe("YYYY-MM-DD"),
        serviceId: z.string().optional().describe("Optional service id"),
        specialistId: z.string().optional().describe("Optional specialist id"),
      }),
      func: async (input) => {
        const body = {
          businessId: String(input.businessId ?? "").trim(),
          date: String(input.date ?? "").trim(),
          serviceId: stripEmptyOptionalString(input.serviceId),
          specialistId: stripEmptyOptionalString(input.specialistId),
        };
        const r = await apiPost<unknown>("/v1/agent/get-availability", body);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "getAvailabilityBulk",
      description:
        "Get bookable slots for several dates at once (YYYY-MM-DD each). Use when the user asks for availability beyond a single day or says 'any day'. Pass up to 14 dates (e.g. next 7 consecutive days).",
      schema: z.object({
        businessId: z.string(),
        dates: z
          .array(z.string())
          .min(1)
          .max(14)
          .describe("List of dates YYYY-MM-DD"),
        specialistId: z.string().optional(),
      }),
      func: async (input) => {
        const body = {
          businessId: String(input.businessId ?? "").trim(),
          dates: (input.dates ?? []).map((d) => String(d).trim()).filter(Boolean),
          specialistId: stripEmptyOptionalString(input.specialistId),
        };
        const r = await apiPost<unknown>("/v1/agent/get-availability-bulk", body);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "getBusinessDetails",
      description:
        "Fetch one business by id: hours, description, location, contactInfo. Use when the user asks for opening hours or full venue details.",
      schema: z.object({
        businessId: z.string().describe("Business id from searchBusinesses"),
      }),
      func: async (input) => {
        const id = encodeURIComponent(String(input.businessId ?? "").trim());
        const r = await apiGet<unknown>(`/v1/businesses/${id}`);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "createBooking",
      description:
        "Create a booking for the current user. time must be an exact ISO slot string from getAvailability. partySize is optional (default 1).",
      schema: z.object({
        businessId: z.string(),
        serviceId: z.string(),
        time: z.string(),
        specialistId: z.string().optional(),
        partySize: z.union([z.number(), z.string()]).optional(),
      }),
      func: async (input) => {
        const userId = ctx.getUserId();
        if (!userId) return JSON.stringify({ error: "User not linked yet; ask for phone number." });
        const partySize = toOptionalPartySize(input.partySize) ?? 1;
        const body = {
          businessId: String(input.businessId ?? "").trim(),
          serviceId: String(input.serviceId ?? "").trim(),
          time: String(input.time ?? "").trim(),
          specialistId: stripEmptyOptionalString(input.specialistId) ?? null,
          partySize: partySize >= 1 && partySize <= 50 ? partySize : 1,
          userId,
        };
        const r = await apiPost<unknown>("/v1/agent/create-booking", body);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "modifyBooking",
      description: "Modify an existing booking time or specialist.",
      schema: z.object({
        bookingId: z.string(),
        newTime: z.string().optional(),
        newSpecialistId: z.string().optional(),
      }),
      func: async (input) => {
        const body = {
          bookingId: String(input.bookingId ?? "").trim(),
          newTime: stripEmptyOptionalString(input.newTime),
          newSpecialistId: stripEmptyOptionalString(input.newSpecialistId) ?? null,
        };
        const r = await apiPost<unknown>("/v1/agent/modify-booking", body);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "cancelBooking",
      description: "Cancel a booking by id.",
      schema: z.object({ bookingId: z.string() }),
      func: async (input) => {
        const r = await apiPost<unknown>("/v1/agent/cancel-booking", {
          bookingId: String(input.bookingId ?? "").trim(),
        });
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "listUserBookings",
      description: "List bookings for the current user (upcoming and past).",
      schema: z.object({
        includePast: z.boolean().optional().describe("Optional; may be omitted."),
      }),
      func: async () => {
        const userId = ctx.getUserId();
        if (!userId) return JSON.stringify({ error: "User not linked" });
        const r = await apiGet<unknown>(`/v1/agent/user-bookings/${userId}`);
        return JSON.stringify(r);
      },
    }),
  ];
}
