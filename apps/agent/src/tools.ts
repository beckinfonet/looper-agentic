import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { apiGet, apiPost } from "./apiClient.js";

export function buildTools(ctx: { getUserId: () => string | undefined }) {
  return [
    new DynamicStructuredTool({
      name: "searchBusinesses",
      description: "Search businesses by type and optional location or preferences.",
      schema: z.object({
        type: z.enum(["restaurant", "spa", "barbershop"]),
        location: z.string().optional(),
        preferences: z.array(z.string()).optional(),
      }),
      func: async (input) => {
        const r = await apiPost<unknown[]>("/v1/agent/search-businesses", input);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "getAvailability",
      description: "Get available time slots for a business on a date (YYYY-MM-DD).",
      schema: z.object({
        businessId: z.string(),
        date: z.string(),
        serviceId: z.string().optional(),
        specialistId: z.string().optional(),
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
        businessId: z.string(),
        serviceId: z.string(),
        time: z.string(),
        specialistId: z.string().nullable().optional(),
        partySize: z.number().int().min(1).optional(),
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
        bookingId: z.string(),
        newTime: z.string().optional(),
        newSpecialistId: z.string().nullable().optional(),
      }),
      func: async (input) => {
        const r = await apiPost<unknown>("/v1/agent/modify-booking", input);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "cancelBooking",
      description: "Cancel a booking by id.",
      schema: z.object({ bookingId: z.string() }),
      func: async (input) => {
        const r = await apiPost<unknown>("/v1/agent/cancel-booking", input);
        return JSON.stringify(r);
      },
    }),
    new DynamicStructuredTool({
      name: "listUserBookings",
      description: "List bookings for the current user (upcoming and past).",
      schema: z.object({}),
      func: async () => {
        const userId = ctx.getUserId();
        if (!userId) return JSON.stringify({ error: "User not linked" });
        const r = await apiGet<unknown>(`/v1/agent/user-bookings/${userId}`);
        return JSON.stringify(r);
      },
    }),
  ];
}
