import mongoose, { Schema, type InferSchemaType } from "mongoose";

const businessHoursSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    open: { type: String, required: true },
    close: { type: String, required: true },
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["restaurant", "spa", "barbershop"],
      required: true,
    },
    location: { type: String, required: true },
    /** Cuisine, services offered, vibe — used in search and Telegram agent preferences. */
    description: { type: String, default: "" },
    /** IANA zone, e.g. Europe/Paris — required for new businesses at registration. */
    timezone: { type: String, default: "" },
    /** Whether customers must pick a specialist, may pick one, or bookings are unassigned. */
    staffChoice: {
      type: String,
      enum: ["required", "optional", "none"],
      default: "optional",
    },
    contactInfo: { type: String, default: "" },
    hours: { type: [businessHoursSchema], default: [] },
  },
  { timestamps: true }
);

businessSchema.index({ type: 1, name: "text", location: "text", description: "text" });

export type BusinessDoc = InferSchemaType<typeof businessSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Business = mongoose.model("Business", businessSchema);
