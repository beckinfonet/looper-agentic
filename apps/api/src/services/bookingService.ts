import mongoose from "mongoose";
import { Availability, availabilityScopeKey } from "../models/Availability.js";
import { Booking } from "../models/Booking.js";
import { Business } from "../models/Business.js";
import { Service } from "../models/Service.js";
import { User } from "../models/User.js";

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function slotSetForDay(slots: string[], targetTime: Date): { has: boolean } {
  const targetIso = targetTime.toISOString();
  const set = new Set(slots.map((s) => new Date(s).toISOString()));
  return { has: set.has(targetIso) };
}

export async function assertSlotOpen(params: {
  businessId: mongoose.Types.ObjectId;
  specialistId?: mongoose.Types.ObjectId | null;
  time: Date;
}): Promise<void> {
  const date = toYmd(params.time);
  const key = availabilityScopeKey(
    String(params.businessId),
    date,
    params.specialistId ? String(params.specialistId) : null
  );
  const av = await Availability.findOne({ scopeKey: key });
  if (!av) {
    const err = new Error("No availability published for this date");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  const { has } = slotSetForDay(av.slots, params.time);
  if (!has) {
    const err = new Error("Requested time is not an available slot");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
}

function specialistKey(id?: mongoose.Types.ObjectId | null): string {
  return id ? String(id) : "";
}

export async function assertNoConflict(params: {
  businessId: mongoose.Types.ObjectId;
  specialistId?: mongoose.Types.ObjectId | null;
  time: Date;
  excludeBookingId?: mongoose.Types.ObjectId;
}): Promise<void> {
  const mine = specialistKey(params.specialistId);

  const existing = await Booking.find({
    businessId: params.businessId,
    time: params.time,
    status: { $nin: ["cancelled"] },
    ...(params.excludeBookingId ? { _id: { $ne: params.excludeBookingId } } : {}),
  });

  for (const b of existing) {
    const theirs = specialistKey(b.specialistId as mongoose.Types.ObjectId | undefined);
    if (mine === theirs) {
      const err = new Error("Slot already booked");
      (err as Error & { statusCode: number }).statusCode = 409;
      throw err;
    }
  }
}

export async function createBooking(input: {
  userId: string;
  businessId: string;
  serviceId: string;
  specialistId?: string | null;
  time: string;
  partySize?: number;
  idempotencyKey?: string | null;
}) {
  if (input.idempotencyKey) {
    const dup = await Booking.findOne({ idempotencyKey: input.idempotencyKey });
    if (dup) return dup;
  }

  const user = await User.findById(input.userId);
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  const business = await Business.findById(input.businessId);
  if (!business) {
    const err = new Error("Business not found");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  const service = await Service.findOne({
    _id: input.serviceId,
    businessId: input.businessId,
  });
  if (!service) {
    const err = new Error("Service not found for business");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }

  const time = new Date(input.time);
  if (Number.isNaN(time.getTime())) {
    const err = new Error("Invalid time");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const specialistOid = input.specialistId
    ? new mongoose.Types.ObjectId(input.specialistId)
    : undefined;

  await assertSlotOpen({
    businessId: business._id,
    specialistId: specialistOid,
    time,
  });
  await assertNoConflict({
    businessId: business._id,
    specialistId: specialistOid,
    time,
  });

  const doc = await Booking.create({
    userId: user._id,
    businessId: business._id,
    serviceId: service._id,
    specialistId: specialistOid,
    time,
    status: "pending",
    partySize: input.partySize ?? 1,
    idempotencyKey: input.idempotencyKey ?? undefined,
  });
  return doc;
}

export async function modifyBooking(input: {
  bookingId: string;
  newTime?: string;
  newSpecialistId?: string | null;
}) {
  const booking = await Booking.findById(input.bookingId);
  if (!booking || booking.status === "cancelled") {
    const err = new Error("Booking not found");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (!["pending", "confirmed", "modified"].includes(booking.status)) {
    const err = new Error("Booking cannot be modified");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const newTime = input.newTime ? new Date(input.newTime) : booking.time;
  if (input.newTime && Number.isNaN(newTime.getTime())) {
    const err = new Error("Invalid newTime");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const specialistId =
    input.newSpecialistId !== undefined
      ? input.newSpecialistId
        ? new mongoose.Types.ObjectId(input.newSpecialistId)
        : undefined
      : (booking.specialistId as mongoose.Types.ObjectId | undefined);

  await assertSlotOpen({
    businessId: booking.businessId as mongoose.Types.ObjectId,
    specialistId: specialistId ?? null,
    time: newTime,
  });
  await assertNoConflict({
    businessId: booking.businessId as mongoose.Types.ObjectId,
    specialistId: specialistId ?? null,
    time: newTime,
    excludeBookingId: booking._id,
  });

  booking.time = newTime;
  if (input.newSpecialistId !== undefined) {
    booking.specialistId = specialistId;
  }
  booking.status = "modified";
  await booking.save();
  return booking;
}

export async function cancelBooking(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error("Booking not found");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (booking.status === "cancelled") return booking;
  booking.status = "cancelled";
  await booking.save();
  return booking;
}
