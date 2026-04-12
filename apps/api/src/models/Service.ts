import mongoose, { Schema, type InferSchemaType } from "mongoose";

const serviceSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 5 },
    priceCents: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export type ServiceDoc = InferSchemaType<typeof serviceSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Service = mongoose.model("Service", serviceSchema);
