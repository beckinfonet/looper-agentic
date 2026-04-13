import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { apiGet, apiPost } from "./apiClient.js";

const businessType = z.preprocess((v) => {
  if (v == null || v === "") return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim().toLowerCase();
  if (t === "restaurant" || t === "spa" || t === "barbershop") return t;
  return undefined;
}, z.enum(["restaurant", "spa", "barbershop"]).optional());

/** Models often send one string instead of string[] for preferences. */
const preferencesList = z.preprocess((v) => {
  if (v == null || v === "") return undefined;
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}, z.array(z.string()).optional());

const optionalNonEmptyString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional(),
);

export function buildTools(ctx: { getUserId: () => string | undefined }) {
  return [
    new DynamicStructuredTool({
      name: "searchBusinesses",
      description:
        "List or search businesses. Response JSON has `businesses` (array). If `note` is present, no exact location/keyword match—still show those businesses. Omit `type` for any category. Only pass `location` if the user names a place that might appear in stored `location` or business `name` (not every city exists in seed data).",
      schema: z.object({
        type: businessType.describe("Leave unset to return all businesses in the database."),
        location: z.preprocess(
          (v) => (v == null || v === "" ? undefined : String(v).trim()),
          z.string().optional(),
        ),
        preferences: preferencesList,
      }),
      func: async (input) => {
        const r = await apiPost<{ businesses: unknown[]; note?: string }>(
          "/v1/agent/search-businesses",
          input,
        );
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "getAvailability",
      description: "Get available time slots for a business on a date (YYYY-MM-DD).",
      schema: z.object({
        businessId: z.coerce.string(),
        date: z.coerce.string(),
        serviceId: optionalNonEmptyString,
        specialistId: optionalNonEmptyString,
      }),
      func: async (input) => {
        const r = await apiPost<unknown>("/v1/agent/get-availability", input);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "createBooking",
      description: "Create a booking for the current user. Requires businessId, serviceId, ISO time string, optional specialistId and partySize.",
      schema: z.object({
        businessId: z.coerce.string(),
        serviceId: z.coerce.string(),
        time: z.coerce.string(),
        specialistId: z.preprocess(
          (v) => (v === "" || v === null || v === undefined ? undefined : v),
          z.string().optional(),
        ),
        partySize: z.preprocess(
          (v) => (v === "" || v === null || v === undefined ? undefined : v),
          z.coerce.number().int().min(1).max(50).optional(),
        ),
      }),
      func: async (input) => {
        const userId = ctx.getUserId();
        if (!userId) return JSON.stringify({ error: "User not linked yet; ask for phone number." });
        const r = await apiPost<unknown>("/v1/agent/create-booking", { ...input, userId });
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "modifyBooking",
      description: "Modify an existing booking time or specialist.",
      schema: z.object({
        bookingId: z.coerce.string(),
        newTime: optionalNonEmptyString,
        newSpecialistId: z.preprocess(
          (v) => (v === "" || v === null || v === undefined ? undefined : v),
          z.string().optional(),
        ),
      }),
      func: async (input) => {
        const r = await apiPost<unknown>("/v1/agent/modify-booking", input);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "cancelBooking",
      description: "Cancel a booking by id.",
      schema: z.object({ bookingId: z.coerce.string() }),
      func: async (input) => {
        const r = await apiPost<unknown>("/v1/agent/cancel-booking", input);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "listUserBookings",
      description: "List bookings for the current user (upcoming and past).",
      // Empty strict objects often fail model binding; passthrough accepts {} or stray keys.
      schema: z.object({}).passthrough(),
      func: async () => {
        const userId = ctx.getUserId();
        if (!userId) return JSON.stringify({ error: "User not linked" });
        const r = await apiGet<unknown>(`/v1/agent/user-bookings/${userId}`);
        return JSON.stringify(r);
      },
    }),
  ];
}
