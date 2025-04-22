import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    client_offset: {
      type: String,
      unique: true, // ensures no duplicate offsets
      sparse: true, // allows multiple docs without this field (useful for optional offset)
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
