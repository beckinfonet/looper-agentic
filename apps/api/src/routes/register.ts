import type { FastifyInstance } from "fastify";
import { z } from "zod";
import mongoose from "mongoose";
import { config } from "../config.js";
import {
  getBearerToken,
  signBusinessToken,
  signUserToken,
  verifyBusinessToken,
  verifyUserToken,
} from "../auth/jwt.js";
import { User } from "../models/User.js";
import { Business } from "../models/Business.js";
import { Specialist } from "../models/Specialist.js";
import { Service } from "../models/Service.js";
import { Availability, availabilityScopeKey } from "../models/Availability.js";
import { Booking } from "../models/Booking.js";
import { Conversation } from "../models/Conversation.js";
import { BusinessUser } from "../models/BusinessUser.js";
import { LinkToken } from "../models/LinkToken.js";
import bcrypt from "bcryptjs";
import {
  cancelBooking,
  createBooking,
  modifyBooking,
} from "../services/bookingService.js";
import crypto from "node:crypto";

function internalKeyOk(req: { headers: Record<string, unknown> }): boolean {
  return req.headers["x-internal-key"] === config.agentInternalKey;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function requireUser(req: { headers: Record<string, unknown> }): Promise<string> {
  const t = getBearerToken(req as Parameters<typeof getBearerToken>[0]);
  if (!t) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }
  return verifyUserToken(t).sub;
}

async function requireBusiness(req: { headers: Record<string, unknown> }): Promise<{
  businessUserId: string;
  businessId: string;
}> {
  const t = getBearerToken(req as Parameters<typeof getBearerToken>[0]);
  if (!t) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }
  const p = verifyBusinessToken(t);
  return { businessUserId: p.sub, businessId: p.businessId };
}

async function bookingToDto(b: InstanceType<typeof Booking>) {
  const [business, service, specialist] = await Promise.all([
    Business.findById(b.businessId).lean(),
    Service.findById(b.serviceId).lean(),
    b.specialistId ? Specialist.findById(b.specialistId).lean() : null,
  ]);
  return {
    id: String(b._id),
    userId: String(b.userId),
    businessId: String(b.businessId),
    businessName: business?.name ?? null,
    serviceId: String(b.serviceId),
    serviceName: service?.name ?? null,
    specialistId: b.specialistId ? String(b.specialistId) : null,
    specialistName: specialist?.name ?? null,
    time: b.time.toISOString(),
    status: b.status,
    partySize: b.partySize ?? 1,
  };
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    const conn = mongoose.connection;
    const mongoReady = conn.readyState === 1;
    const databaseName = conn.db?.databaseName ?? null;
    let businessModelEstimatedCount: number | null = null;
    let businessesCollectionEstimatedCount: number | null = null;
    if (mongoReady && conn.db) {
      try {
        businessModelEstimatedCount = await Business.estimatedDocumentCount();
      } catch {
        businessModelEstimatedCount = null;
      }
      try {
        businessesCollectionEstimatedCount = await conn.db
          .collection("businesses")
          .estimatedDocumentCount();
      } catch {
        businessesCollectionEstimatedCount = null;
      }
    }
    return {
      ok: true,
      mongo: {
        ready: mongoReady,
        /** Active DB on this connection (should be `looper` in prod). */
        databaseName,
        /** From env; if set but databaseName differs, deployment may be old code. */
        configuredDbName: config.mongoDbName ?? null,
        businessModelCollection: Business.collection.name,
        businessModelEstimatedCount,
        /** Raw `businesses` collection in the active DB (for collection-name mismatches). */
        businessesCollectionEstimatedCount,
      },
    };
  });

  app.post(
    "/v1/users/register",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const body = z
        .object({
          phoneNumber: z.string().min(5),
          name: z.string().min(1),
        })
        .parse(req.body);

      let user = await User.findOne({ phoneNumber: body.phoneNumber });
      if (!user) {
        user = await User.create({
          phoneNumber: body.phoneNumber,
          name: body.name,
        });
      } else {
        user.name = body.name;
        await user.save();
      }
      const token = signUserToken(String(user._id));
      return reply.send({
        token,
        user: {
          id: String(user._id),
          phoneNumber: user.phoneNumber,
          name: user.name,
        },
      });
    }
  );

  app.post(
    "/v1/users/link-phone",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      if (!internalKeyOk(req)) {
        return reply.status(401).send({ error: "Invalid internal key" });
      }
      const body = z
        .object({
          telegramId: z.string().optional(),
          whatsappId: z.string().optional(),
          phoneNumber: z.string().min(5),
          name: z.string().optional(),
        })
        .parse(req.body);

      let user = await User.findOne({ phoneNumber: body.phoneNumber });
      if (!user) {
        user = await User.create({
          phoneNumber: body.phoneNumber,
          name: body.name ?? "Customer",
          telegramId: body.telegramId,
          whatsappId: body.whatsappId,
        });
      } else {
        if (body.telegramId) user.telegramId = body.telegramId;
        if (body.whatsappId) user.whatsappId = body.whatsappId;
        if (body.name) user.name = body.name;
        await user.save();
      }
      return reply.send({
        userId: String(user._id),
        user: {
          id: String(user._id),
          phoneNumber: user.phoneNumber,
          name: user.name,
        },
      });
    }
  );

  app.get("/v1/users/by-telegram/:telegramId", async (req, reply) => {
    if (!internalKeyOk(req)) {
      return reply.status(401).send({ error: "Invalid internal key" });
    }
    const { telegramId } = req.params as { telegramId: string };
    const user = await User.findOne({ telegramId });
    if (!user) return reply.status(404).send({ error: "Not found" });
    return reply.send({
      id: String(user._id),
      phoneNumber: user.phoneNumber,
      name: user.name,
    });
  });

  app.post("/v1/link-tokens", async (req, reply) => {
    const userId = await requireUser(req);
    const raw = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await LinkToken.create({
      token: raw,
      userId: new mongoose.Types.ObjectId(userId),
      expiresAt,
    });
    return reply.send({ token: raw, expiresAt: expiresAt.toISOString() });
  });

  app.get("/v1/link-tokens/:token/resolve", async (req, reply) => {
    if (!internalKeyOk(req)) {
      return reply.status(401).send({ error: "Invalid internal key" });
    }
    const { token } = req.params as { token: string };
    const row = await LinkToken.findOne({ token });
    if (!row || row.expiresAt.getTime() < Date.now()) {
      return reply.status(404).send({ error: "Invalid or expired token" });
    }
    return reply.send({ userId: String(row.userId) });
  });

  app.get("/v1/businesses", async (req) => {
    const q = z
      .object({
        type: z.enum(["restaurant", "spa", "barbershop"]).optional(),
        location: z.string().optional(),
      })
      .parse(req.query);

    const filter: Record<string, unknown> = {};
    if (q.type) filter.type = q.type;
    if (q.location) {
      const safe = escapeRegExp(q.location);
      filter.$or = [
        { location: new RegExp(safe, "i") },
        { name: new RegExp(safe, "i") },
        { description: new RegExp(safe, "i") },
      ];
    }
    const rows = await Business.find(filter).limit(50).lean();
    return rows.map((b) => ({
      id: String(b._id),
      name: b.name,
      type: b.type,
      location: b.location,
      description: b.description ?? "",
      contactInfo: b.contactInfo,
    }));
  });

  app.get("/v1/businesses/:id", async (req, reply) => {
    const b = await Business.findById((req.params as { id: string }).id).lean();
    if (!b) return reply.status(404).send({ error: "Not found" });
    return reply.send({
      id: String(b._id),
      name: b.name,
      type: b.type,
      location: b.location,
      description: b.description ?? "",
      contactInfo: b.contactInfo,
      hours: b.hours ?? [],
    });
  });

  app.get("/v1/businesses/:id/services", async (req, reply) => {
    const businessId = (req.params as { id: string }).id;
    const rows = await Service.find({ businessId }).lean();
    return reply.send(
      rows.map((s) => ({
        id: String(s._id),
        businessId: String(s.businessId),
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
      }))
    );
  });

  app.get("/v1/businesses/:id/specialists", async (req, reply) => {
    const businessId = (req.params as { id: string }).id;
    const rows = await Specialist.find({ businessId }).lean();
    return reply.send(
      rows.map((s) => ({
        id: String(s._id),
        businessId: String(s.businessId),
        name: s.name,
        role: s.role,
        schedule: s.schedule ?? [],
      }))
    );
  });

  app.get("/v1/availability", async (req, reply) => {
    const q = z
      .object({
        businessId: z.string(),
        date: z.string(),
        serviceId: z.string().optional(),
        specialistId: z.string().optional(),
      })
      .parse(req.query);

    const key = availabilityScopeKey(q.businessId, q.date, q.specialistId ?? null);
    const av = await Availability.findOne({ scopeKey: key }).lean();
    if (!av) return reply.send({ businessId: q.businessId, date: q.date, slots: [] });
    return reply.send({
      businessId: q.businessId,
      date: q.date,
      specialistId: q.specialistId ?? null,
      slots: av.slots,
    });
  });

  app.get("/v1/bookings/me", async (req, reply) => {
    const userId = await requireUser(req);
    const rows = await Booking.find({ userId }).sort({ time: -1 }).limit(200);
    const out = await Promise.all(rows.map((b) => bookingToDto(b)));
    return reply.send(out);
  });

  app.get("/v1/bookings/:id", async (req, reply) => {
    const userId = await requireUser(req);
    const b = await Booking.findById((req.params as { id: string }).id);
    if (!b || String(b.userId) !== userId) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.send(await bookingToDto(b));
  });

  app.post(
    "/v1/bookings",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const userId = await requireUser(req);
      const body = z
        .object({
          businessId: z.string(),
          serviceId: z.string(),
          specialistId: z.string().nullable().optional(),
          time: z.string(),
          partySize: z.number().int().min(1).optional(),
          idempotencyKey: z.string().optional(),
        })
        .parse(req.body);

      const idem = req.headers["idempotency-key"];
      const idempotencyKey =
        typeof idem === "string" && idem.length > 0 ? idem : body.idempotencyKey;

      try {
        const doc = await createBooking({
          userId,
          businessId: body.businessId,
          serviceId: body.serviceId,
          specialistId: body.specialistId ?? undefined,
          time: body.time,
          partySize: body.partySize,
          idempotencyKey: idempotencyKey ?? null,
        });
        return reply.status(201).send(await bookingToDto(doc));
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        const code = err.statusCode ?? 500;
        return reply.status(code).send({ error: err.message });
      }
    }
  );

  app.patch("/v1/bookings/:id", async (req, reply) => {
    const userId = await requireUser(req);
    const id = (req.params as { id: string }).id;
    const b = await Booking.findById(id);
    if (!b || String(b.userId) !== userId) {
      return reply.status(404).send({ error: "Not found" });
    }
    const body = z
      .object({
        newTime: z.string().optional(),
        newSpecialistId: z.string().nullable().optional(),
      })
      .parse(req.body);
    try {
      const doc = await modifyBooking({
        bookingId: id,
        newTime: body.newTime,
        newSpecialistId: body.newSpecialistId,
      });
      return reply.send(await bookingToDto(doc));
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  app.post("/v1/bookings/:id/cancel", async (req, reply) => {
    const userId = await requireUser(req);
    const id = (req.params as { id: string }).id;
    const b = await Booking.findById(id);
    if (!b || String(b.userId) !== userId) {
      return reply.status(404).send({ error: "Not found" });
    }
    try {
      const doc = await cancelBooking(id);
      return reply.send(await bookingToDto(doc));
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  app.post("/v1/conversations/messages", async (req, reply) => {
    if (!internalKeyOk(req)) {
      return reply.status(401).send({ error: "Invalid internal key" });
    }
    const body = z
      .object({
        userId: z.string(),
        channel: z.enum(["telegram", "whatsapp"]),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      })
      .parse(req.body);

    const uid = new mongoose.Types.ObjectId(body.userId);
    const conv = await Conversation.findOneAndUpdate(
      { userId: uid, channel: body.channel },
      {
        $push: {
          messages: { role: body.role, content: body.content, at: new Date() },
        },
        $setOnInsert: { userId: uid, channel: body.channel },
      },
      { upsert: true, new: true }
    );
    return reply.send({ id: String(conv!._id), messageCount: conv!.messages.length });
  });

  app.post("/v1/business-auth/register", async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        businessName: z.string().min(1),
        type: z.enum(["restaurant", "spa", "barbershop"]),
        location: z.string().min(1),
      })
      .parse(req.body);

    const exists = await BusinessUser.findOne({ email: body.email });
    if (exists) return reply.status(409).send({ error: "Email in use" });

    const business = await Business.create({
      name: body.businessName,
      type: body.type,
      location: body.location,
      contactInfo: body.email,
    });
    const passwordHash = await bcrypt.hash(body.password, 10);
    const bu = await BusinessUser.create({
      email: body.email,
      passwordHash,
      businessId: business._id,
    });
    const token = signBusinessToken(String(bu._id), String(business._id));
    return reply.send({
      token,
      business: { id: String(business._id), name: business.name },
    });
  });

  app.post(
    "/v1/business-auth/login",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string(),
        })
        .parse(req.body);
      const bu = await BusinessUser.findOne({ email: body.email });
      if (!bu) return reply.status(401).send({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(body.password, bu.passwordHash);
      if (!ok) return reply.status(401).send({ error: "Invalid credentials" });
      const token = signBusinessToken(String(bu._id), String(bu.businessId));
      return reply.send({
        token,
        businessId: String(bu.businessId),
      });
    }
  );

  app.get("/v1/business/me", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const b = await Business.findById(businessId).lean();
    if (!b) return reply.status(404).send({ error: "Not found" });
    return reply.send({
      id: String(b._id),
      name: b.name,
      type: b.type,
      location: b.location,
      contactInfo: b.contactInfo,
      hours: b.hours ?? [],
    });
  });

  app.patch("/v1/business/me", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const body = z
      .object({
        name: z.string().optional(),
        location: z.string().optional(),
        contactInfo: z.string().optional(),
        hours: z
          .array(
            z.object({
              dayOfWeek: z.number().int().min(0).max(6),
              open: z.string(),
              close: z.string(),
            })
          )
          .optional(),
      })
      .parse(req.body);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.location !== undefined) patch.location = body.location;
    if (body.contactInfo !== undefined) patch.contactInfo = body.contactInfo;
    if (body.hours !== undefined) patch.hours = body.hours;
    const b = await Business.findByIdAndUpdate(businessId, { $set: patch }, { new: true }).lean();
    return reply.send(b);
  });

  app.post("/v1/business/services", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const body = z
      .object({
        name: z.string(),
        durationMinutes: z.number().int().min(5),
        priceCents: z.number().int().min(0).optional(),
      })
      .parse(req.body);
    const s = await Service.create({
      businessId,
      name: body.name,
      durationMinutes: body.durationMinutes,
      priceCents: body.priceCents ?? 0,
    });
    return reply.status(201).send({
      id: String(s._id),
      businessId: String(s.businessId),
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
    });
  });

  app.get("/v1/business/services", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const rows = await Service.find({ businessId }).lean();
    return reply.send(
      rows.map((s) => ({
        id: String(s._id),
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
      }))
    );
  });

  app.post("/v1/business/specialists", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const body = z
      .object({
        name: z.string(),
        role: z.string(),
        schedule: z
          .array(
            z.object({
              dayOfWeek: z.number().int().min(0).max(6),
              start: z.string(),
              end: z.string(),
            })
          )
          .optional(),
      })
      .parse(req.body);
    const s = await Specialist.create({
      businessId,
      name: body.name,
      role: body.role,
      schedule: body.schedule ?? [],
    });
    return reply.status(201).send({
      id: String(s._id),
      name: s.name,
      role: s.role,
      schedule: s.schedule,
    });
  });

  app.get("/v1/business/specialists", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const rows = await Specialist.find({ businessId }).lean();
    return reply.send(rows);
  });

  app.put("/v1/business/availability", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const body = z
      .object({
        date: z.string(),
        specialistId: z.string().nullable().optional(),
        slots: z.array(z.string()),
      })
      .parse(req.body);

    const scopeKey = availabilityScopeKey(
      businessId,
      body.date,
      body.specialistId ?? null
    );
    const av = await Availability.findOneAndUpdate(
      { scopeKey },
      {
        businessId,
        specialistId: body.specialistId ? new mongoose.Types.ObjectId(body.specialistId) : undefined,
        date: body.date,
        slots: body.slots,
        scopeKey,
      },
      { upsert: true, new: true }
    );
    return reply.send({
      id: String(av!._id),
      businessId: String(av!.businessId),
      date: av!.date,
      specialistId: av!.specialistId ? String(av!.specialistId) : null,
      slots: av!.slots,
    });
  });

  app.get("/v1/business/bookings", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const rows = await Booking.find({ businessId }).sort({ time: -1 }).limit(200);
    const out = await Promise.all(rows.map((b) => bookingToDto(b)));
    return reply.send(out);
  });

  app.patch("/v1/business/bookings/:id", async (req, reply) => {
    const { businessId } = await requireBusiness(req);
    const id = (req.params as { id: string }).id;
    const b = await Booking.findById(id);
    if (!b || String(b.businessId) !== businessId) {
      return reply.status(404).send({ error: "Not found" });
    }
    const body = z
      .object({
        status: z.enum(["pending", "confirmed", "modified", "cancelled"]).optional(),
      })
      .parse(req.body);
    if (body.status) b.status = body.status;
    await b.save();
    return reply.send(await bookingToDto(b));
  });

  app.post("/v1/agent/search-businesses", async (req, reply) => {
    if (!internalKeyOk(req)) return reply.status(401).send({ error: "Unauthorized" });
    const body = z
      .object({
        /** Omit to search all types (matches mobile GET /v1/businesses with no query). */
        type: z.enum(["restaurant", "spa", "barbershop"]).nullish(),
        location: z.string().optional(),
        preferences: z.array(z.string()).optional(),
      })
      .parse((req as { body: unknown }).body);

    const filter: Record<string, unknown> = {};
    if (body.type) filter.type = body.type;
    const locTrim = body.location?.trim() ?? "";
    if (locTrim) {
      const safe = escapeRegExp(locTrim);
      filter.$or = [
        { location: new RegExp(safe, "i") },
        { name: new RegExp(safe, "i") },
        { description: new RegExp(safe, "i") },
      ];
    }
    let rows = await Business.find(filter).limit(50).lean();
    if (body.preferences?.length) {
      const prefs = body.preferences.map((p) => p.toLowerCase());
      rows = rows.filter((r) =>
        prefs.some(
          (p) =>
            r.name.toLowerCase().includes(p) ||
            r.location.toLowerCase().includes(p) ||
            (r.description && r.description.toLowerCase().includes(p)),
        ),
      );
    }

    const hasStrictExtras = Boolean(locTrim) || Boolean(body.preferences?.length);
    let note: string | undefined;
    if (rows.length === 0 && hasStrictExtras) {
      const relaxed: Record<string, unknown> = {};
      if (body.type) relaxed.type = body.type;
      const fallback = await Business.find(relaxed).limit(50).lean();
      if (fallback.length > 0) {
        rows = fallback;
        note =
          "No row matched that city/keywords in name or location (data may only list areas like “Downtown”). " +
          "These businesses still exist in the app—offer one by name and location.";
      }
    }

    const businesses = rows.map((b) => ({
      id: String(b._id),
      name: b.name,
      type: b.type,
      location: b.location,
      description: b.description ?? "",
    }));
    return note
      ? reply.send({ businesses, note })
      : reply.send({ businesses });
  });

  app.post("/v1/agent/get-availability", async (req, reply) => {
    if (!internalKeyOk(req)) return reply.status(401).send({ error: "Unauthorized" });
    const body = z
      .object({
        businessId: z.string(),
        serviceId: z.string().optional(),
        specialistId: z.string().optional(),
        date: z.string(),
      })
      .parse((req as { body: unknown }).body);

    const key = availabilityScopeKey(
      body.businessId,
      body.date,
      body.specialistId ?? null
    );
    const av = await Availability.findOne({ scopeKey: key }).lean();
    return reply.send({
      businessId: body.businessId,
      date: body.date,
      slots: av?.slots ?? [],
    });
  });

  app.post("/v1/agent/create-booking", async (req, reply) => {
    if (!internalKeyOk(req)) return reply.status(401).send({ error: "Unauthorized" });
    const body = z
      .object({
        businessId: z.string(),
        serviceId: z.string(),
        specialistId: z.string().nullable().optional(),
        time: z.string(),
        userId: z.string(),
        partySize: z.number().int().min(1).optional(),
      })
      .parse((req as { body: unknown }).body);
    try {
      const doc = await createBooking({
        userId: body.userId,
        businessId: body.businessId,
        serviceId: body.serviceId,
        specialistId: body.specialistId ?? undefined,
        time: body.time,
        partySize: body.partySize,
      });
      return reply.status(201).send(await bookingToDto(doc));
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  app.post("/v1/agent/modify-booking", async (req, reply) => {
    if (!internalKeyOk(req)) return reply.status(401).send({ error: "Unauthorized" });
    const body = z
      .object({
        bookingId: z.string(),
        newTime: z.string().optional(),
        newSpecialistId: z.string().nullable().optional(),
      })
      .parse((req as { body: unknown }).body);
    try {
      const doc = await modifyBooking(body);
      return reply.send(await bookingToDto(doc));
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  app.post("/v1/agent/cancel-booking", async (req, reply) => {
    if (!internalKeyOk(req)) return reply.status(401).send({ error: "Unauthorized" });
    const body = z
      .object({ bookingId: z.string() })
      .parse((req as { body: unknown }).body);
    try {
      const doc = await cancelBooking(body.bookingId);
      return reply.send(await bookingToDto(doc));
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  app.get("/v1/agent/user-bookings/:userId", async (req, reply) => {
    if (!internalKeyOk(req)) return reply.status(401).send({ error: "Unauthorized" });
    const { userId } = req.params as { userId: string };
    const rows = await Booking.find({ userId }).sort({ time: -1 }).limit(100);
    const out = await Promise.all(rows.map((b) => bookingToDto(b)));
    return reply.send(out);
  });

  app.post("/v1/whatsapp/webhook", async (req, reply) => {
    return reply.send({
      status: "not_implemented",
      message: "WhatsApp adapter is deferred. Configure Meta Cloud API or a BSP, then forward webhooks here.",
      receivedAt: new Date().toISOString(),
    });
  });
}
