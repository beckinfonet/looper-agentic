import mongoose, { Schema, type InferSchemaType } from "mongoose";

const businessUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  },
  { timestamps: true }
);

export type BusinessUserDoc = InferSchemaType<typeof businessUserSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const BusinessUser = mongoose.model("BusinessUser", businessUserSchema);
