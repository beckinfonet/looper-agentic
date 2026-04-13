import "dotenv/config";
import { connectDb, disconnectDb } from "../db.js";
import { Business } from "../models/Business.js";
import { Service } from "../models/Service.js";
import { Availability, availabilityScopeKey } from "../models/Availability.js";
import { User } from "../models/User.js";
import { BusinessUser } from "../models/BusinessUser.js";
import bcrypt from "bcryptjs";

async function main() {
  await connectDb();

  const existing = await Business.findOne({ name: "Demo Bistro" });
  if (existing) {
    await Service.deleteMany({ businessId: existing._id });
    await Availability.deleteMany({ businessId: existing._id });
    await BusinessUser.deleteMany({ businessId: existing._id });
    await Business.deleteOne({ _id: existing._id });
  }
  await User.deleteMany({ phoneNumber: "+10000000000" });
  await BusinessUser.deleteMany({ email: "owner@demobistro.test" });

  const business = await Business.create({
    name: "Demo Bistro",
    type: "restaurant",
    location: "Downtown",
    contactInfo: "owner@demobistro.test",
    hours: [
      { dayOfWeek: 1, open: "11:00", close: "22:00" },
      { dayOfWeek: 2, open: "11:00", close: "22:00" },
    ],
  });

  const service = await Service.create({
    businessId: business._id,
    name: "Dinner reservation",
    durationMinutes: 90,
    priceCents: 0,
  });

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const ymd = tomorrow.toISOString().slice(0, 10);
  const t1 = new Date(`${ymd}T19:30:00.000Z`).toISOString();
  const t2 = new Date(`${ymd}T20:00:00.000Z`).toISOString();

  await Availability.create({
    businessId: business._id,
    date: ymd,
    slots: [t1, t2],
    scopeKey: availabilityScopeKey(String(business._id), ymd, null),
  });

  const passwordHash = await bcrypt.hash("password123", 10);
  await BusinessUser.create({
    email: "owner@demobistro.test",
    passwordHash,
    businessId: business._id,
  });

  await User.create({
    phoneNumber: "+10000000000",
    name: "Demo Customer",
  });

  // eslint-disable-next-line no-console
  console.log("Seed OK:", {
    businessId: String(business._id),
    serviceId: String(service._id),
    sampleDate: ymd,
    slots: [t1, t2],
    businessLogin: { email: "owner@demobistro.test", password: "password123" },
    customerPhone: "+10000000000",
  });

  await disconnectDb();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
