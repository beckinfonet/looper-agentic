import mongoose, { Schema, type InferSchemaType } from "mongoose";

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    channel: { type: String, enum: ["telegram", "whatsapp"], required: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, channel: 1 }, { unique: true });

export type ConversationDoc = InferSchemaType<typeof conversationSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Conversation = mongoose.model("Conversation", conversationSchema);
