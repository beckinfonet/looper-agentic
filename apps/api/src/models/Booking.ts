import mongoose, { Schema, type InferSchemaType } from "mongoose";

const bookingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    specialistId: { type: Schema.Types.ObjectId, ref: "Specialist", default: undefined },
    time: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "modified", "cancelled"],
      default: "pending",
      index: true,
    },
    partySize: { type: Number, min: 1, default: 1 },
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true }
);

bookingSchema.index({ businessId: 1, time: 1 });
bookingSchema.index({ userId: 1, time: -1 });

export type BookingDoc = InferSchemaType<typeof bookingSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Booking = mongoose.model("Booking", bookingSchema);
