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
    contactInfo: { type: String, default: "" },
    hours: { type: [businessHoursSchema], default: [] },
  },
  { timestamps: true }
);

businessSchema.index({ type: 1, location: "text", name: "text" });

export type BusinessDoc = InferSchemaType<typeof businessSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Business = mongoose.model("Business", businessSchema);
