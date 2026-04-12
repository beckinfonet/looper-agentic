import mongoose, { Schema, type InferSchemaType } from "mongoose";

const availabilitySchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    specialistId: { type: Schema.Types.ObjectId, ref: "Specialist", default: undefined },
    date: { type: String, required: true },
    slots: { type: [String], default: [] },
    scopeKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

availabilitySchema.index({ businessId: 1, date: 1 });

export function availabilityScopeKey(
  businessId: string,
  date: string,
  specialistId?: string | null
): string {
  const s = specialistId ? String(specialistId) : "none";
  return `${businessId}|${date}|${s}`;
}

export type AvailabilityDoc = InferSchemaType<typeof availabilitySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Availability = mongoose.model("Availability", availabilitySchema);
