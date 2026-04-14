import "dotenv/config";
import type { Types } from "mongoose";
import { connectDb, disconnectDb } from "../db.js";
import { Business } from "../models/Business.js";
import { Service } from "../models/Service.js";
import { Availability, availabilityScopeKey } from "../models/Availability.js";
import { User } from "../models/User.js";
import { BusinessUser } from "../models/BusinessUser.js";
import bcrypt from "bcryptjs";

const SEED_EMAIL = /@seed\.looper\.dev$/i;
const LEGACY_DEMO_NAMES = ["Demo Bistro"];

type Hour = { dayOfWeek: number; open: string; close: string };

type SeedBusiness = {
  slug: string;
  name: string;
  type: "restaurant" | "spa" | "barbershop";
  location: string;
  /** IANA time zone for the venue. */
  timezone: string;
  description: string;
  hours: Hour[];
  services: { name: string; durationMinutes: number; priceCents: number }[];
  /** First with dashboard login */
  dashboardOwner?: boolean;
};

const WEEK_LUNCH_DINNER: Hour[] = [
  { dayOfWeek: 1, open: "11:30", close: "22:00" },
  { dayOfWeek: 2, open: "11:30", close: "22:00" },
  { dayOfWeek: 3, open: "11:30", close: "22:00" },
  { dayOfWeek: 4, open: "11:30", close: "22:00" },
  { dayOfWeek: 5, open: "11:30", close: "23:00" },
  { dayOfWeek: 6, open: "10:00", close: "23:00" },
  { dayOfWeek: 0, open: "10:00", close: "21:30" },
];

const SPA_HOURS: Hour[] = [
  { dayOfWeek: 1, open: "09:00", close: "20:00" },
  { dayOfWeek: 2, open: "09:00", close: "20:00" },
  { dayOfWeek: 3, open: "09:00", close: "20:00" },
  { dayOfWeek: 4, open: "09:00", close: "20:00" },
  { dayOfWeek: 5, open: "09:00", close: "21:00" },
  { dayOfWeek: 6, open: "09:00", close: "21:00" },
  { dayOfWeek: 0, open: "10:00", close: "18:00" },
];

const BARBER_HOURS: Hour[] = [
  { dayOfWeek: 1, open: "09:00", close: "19:00" },
  { dayOfWeek: 2, open: "09:00", close: "19:00" },
  { dayOfWeek: 3, open: "09:00", close: "19:00" },
  { dayOfWeek: 4, open: "09:00", close: "19:00" },
  { dayOfWeek: 5, open: "09:00", close: "20:00" },
  { dayOfWeek: 6, open: "08:00", close: "18:00" },
  { dayOfWeek: 0, open: "10:00", close: "16:00" },
];

function contact(slug: string): string {
  return `reservations+${slug}@seed.looper.dev`;
}

const SEED_BUSINESSES: SeedBusiness[] = [
  {
    slug: "kinjo",
    name: "Kinjo Ramen",
    type: "restaurant",
    location: "Brooklyn, NY — Williamsburg",
    timezone: "America/New_York",
    description:
      "Japanese ramen and small plates. Tonkotsu, shoyu, vegetarian miso broth. Sake and highballs.",
    hours: WEEK_LUNCH_DINNER,
    services: [
      { name: "Counter seating — 2 guests", durationMinutes: 75, priceCents: 0 },
      { name: "Table for 4", durationMinutes: 90, priceCents: 0 },
    ],
    dashboardOwner: true,
  },
  {
    slug: "lupa",
    name: "Trattoria Lupa",
    type: "restaurant",
    location: "San Francisco, CA — North Beach",
    timezone: "America/Los_Angeles",
    description:
      "Neighborhood Italian: handmade pasta, wood-fired pizza, antipasti. Wine list focused on Piedmont and Tuscany.",
    hours: WEEK_LUNCH_DINNER,
    services: [
      { name: "Dinner reservation", durationMinutes: 90, priceCents: 0 },
      { name: "Pasta tasting menu", durationMinutes: 120, priceCents: 15000 },
    ],
  },
  {
    slug: "casaverde",
    name: "Casa Verde Taquería",
    type: "restaurant",
    location: "Milpitas, CA — McCarthy Ranch",
    timezone: "America/Los_Angeles",
    description:
      "California-Mexican tacos, burritos, and aguas frescas. Carnitas and grilled fish daily.",
    hours: WEEK_LUNCH_DINNER,
    services: [
      { name: "Family table (6)", durationMinutes: 60, priceCents: 0 },
      { name: "Outdoor patio — 2", durationMinutes: 45, priceCents: 0 },
    ],
  },
  {
    slug: "copper",
    name: "The Copper Skillet",
    type: "restaurant",
    location: "Oakland, CA — Downtown",
    timezone: "America/Los_Angeles",
    description:
      "American brunch and dinner. Fried chicken, burgers, seasonal salads. Weekend jazz brunch.",
    hours: WEEK_LUNCH_DINNER,
    services: [
      { name: "Brunch — party of 4", durationMinutes: 75, priceCents: 0 },
      { name: "Dinner — 2", durationMinutes: 90, priceCents: 0 },
    ],
  },
  {
    slug: "lemongrass",
    name: "Lemongrass Kitchen",
    type: "restaurant",
    location: "San Jose, CA — Rose Garden",
    timezone: "America/Los_Angeles",
    description:
      "Thai curries, papaya salad, pad thai, and Isaan-style grilled meats. Vegan options marked on menu.",
    hours: WEEK_LUNCH_DINNER,
    services: [
      { name: "Standard table", durationMinutes: 60, priceCents: 0 },
      { name: "Chef's tasting", durationMinutes: 120, priceCents: 9500 },
    ],
  },
  {
    slug: "harbor",
    name: "Harbor & Vine",
    type: "restaurant",
    location: "San Francisco, CA — Embarcadero",
    timezone: "America/Los_Angeles",
    description:
      "Pacific seafood and natural wine. Oysters, crudo, whole grilled fish. Sunset views.",
    hours: WEEK_LUNCH_DINNER,
    services: [{ name: "Window table — 2", durationMinutes: 90, priceCents: 0 }],
  },
  {
    slug: "stillwater",
    name: "Stillwater Day Spa",
    type: "spa",
    location: "Palo Alto, CA — University Ave",
    timezone: "America/Los_Angeles",
    description:
      "Massage (Swedish, deep tissue, hot stone), facials, and couples suites. Quiet lounge with tea service.",
    hours: SPA_HOURS,
    services: [
      { name: "60-minute massage", durationMinutes: 60, priceCents: 14000 },
      { name: "90-minute massage + facial", durationMinutes: 90, priceCents: 22000 },
    ],
  },
  {
    slug: "brooklyn-body",
    name: "Brooklyn Bodywork",
    type: "spa",
    location: "Brooklyn, NY — Park Slope",
    timezone: "America/New_York",
    description:
      "Sports massage, prenatal, and aromatherapy. Infrared sauna add-on. HSA/FSA friendly receipts.",
    hours: SPA_HOURS,
    services: [{ name: "Therapeutic massage", durationMinutes: 75, priceCents: 12500 }],
  },
  {
    slug: "fulton-fade",
    name: "Fulton Fade Lab",
    type: "barbershop",
    location: "Brooklyn, NY — Fort Greene",
    timezone: "America/New_York",
    description:
      "Fades, tapers, beard sculpting, and hot-towel shaves. Book by barber name online.",
    hours: BARBER_HOURS,
    services: [
      { name: "Haircut + lineup", durationMinutes: 45, priceCents: 4500 },
      { name: "Haircut + beard", durationMinutes: 60, priceCents: 6000 },
    ],
  },
  {
    slug: "mission-cut",
    name: "Mission Cut Co.",
    type: "barbershop",
    location: "San Francisco, CA — Mission District",
    timezone: "America/Los_Angeles",
    description:
      "Classic barbershop cuts for all hair textures. Walk-ins welcome weekday lunch.",
    hours: BARBER_HOURS,
    services: [{ name: "Standard cut", durationMinutes: 30, priceCents: 3500 }],
  },
];

async function wipePriorSeed(): Promise<void> {
  const legacy = await Business.find({
    $or: [{ name: { $in: LEGACY_DEMO_NAMES } }, { contactInfo: SEED_EMAIL }],
  }).select("_id");
  const ids = legacy.map((d) => d._id);
  if (ids.length === 0) return;
  await Service.deleteMany({ businessId: { $in: ids } });
  await Availability.deleteMany({ businessId: { $in: ids } });
  await BusinessUser.deleteMany({ businessId: { $in: ids } });
  await Business.deleteMany({ _id: { $in: ids } });
}

async function main() {
  await connectDb();
  await wipePriorSeed();

  await BusinessUser.deleteMany({ email: SEED_EMAIL });
  await BusinessUser.deleteMany({ email: "owner@demobistro.test" });
  await User.deleteMany({ phoneNumber: "+10000000000" });

  /** Next N calendar days in UTC (YYYY-MM-DD), starting tomorrow. */
  const upcomingDates = (n: number): string[] => {
    const out: string[] = [];
    for (let i = 1; i <= n; i++) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  };
  const dates7 = upcomingDates(7);
  const sampleYmd = dates7[0]!;

  const created: { name: string; id: string; services: string[] }[] = [];
  let ownerBusinessId: Types.ObjectId | null = null;

  for (const def of SEED_BUSINESSES) {
    const b = await Business.create({
      name: def.name,
      type: def.type,
      location: def.location,
      timezone: def.timezone,
      description: def.description,
      contactInfo: contact(def.slug),
      hours: def.hours,
    });
    const serviceIds: string[] = [];
    for (const s of def.services) {
      const svc = await Service.create({
        businessId: b._id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        priceCents: s.priceCents,
      });
      serviceIds.push(String(svc._id));
    }
    for (const ymd of dates7) {
      const slotA = new Date(`${ymd}T18:00:00.000Z`).toISOString();
      const slotB = new Date(`${ymd}T19:30:00.000Z`).toISOString();
      const slotC = new Date(`${ymd}T20:00:00.000Z`).toISOString();
      await Availability.create({
        businessId: b._id,
        date: ymd,
        slots: [slotA, slotB, slotC],
        scopeKey: availabilityScopeKey(String(b._id), ymd, null),
      });
    }
    created.push({ name: def.name, id: String(b._id), services: serviceIds });
    if (def.dashboardOwner) ownerBusinessId = b._id;
  }

  if (ownerBusinessId) {
    const passwordHash = await bcrypt.hash("password123", 10);
    await BusinessUser.create({
      email: "owner+kinjo@seed.looper.dev",
      passwordHash,
      businessId: ownerBusinessId,
    });
  }

  await User.create({
    phoneNumber: "+10000000000",
    name: "Demo Customer",
  });

  // eslint-disable-next-line no-console
  console.log("Seed OK:", {
    businesses: created.length,
    availabilityDatesUtc: dates7,
    sampleDate: sampleYmd,
    dashboardLogin: { email: "owner+kinjo@seed.looper.dev", password: "password123" },
    customerPhone: "+10000000000",
    ids: created.map((c) => ({ name: c.name, businessId: c.id })),
  });

  await disconnectDb();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
