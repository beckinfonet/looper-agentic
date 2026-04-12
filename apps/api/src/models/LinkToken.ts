import mongoose, { Schema, type InferSchemaType } from "mongoose";

const linkTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

export type LinkTokenDoc = InferSchemaType<typeof linkTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const LinkToken = mongoose.model("LinkToken", linkTokenSchema);
