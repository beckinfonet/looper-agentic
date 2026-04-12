import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    phoneNumber: { type: String, required: true, index: true },
    telegramId: { type: String, sparse: true, unique: true },
    whatsappId: { type: String, sparse: true, unique: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.index({ phoneNumber: 1 }, { unique: true });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = mongoose.model("User", userSchema);
