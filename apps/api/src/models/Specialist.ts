import mongoose, { Schema, type InferSchemaType } from "mongoose";

const scheduleEntrySchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const specialistSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    schedule: { type: [scheduleEntrySchema], default: [] },
  },
  { timestamps: true }
);

export type SpecialistDoc = InferSchemaType<typeof specialistSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Specialist = mongoose.model("Specialist", specialistSchema);
