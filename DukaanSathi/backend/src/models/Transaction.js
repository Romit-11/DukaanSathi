import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  idempotencyKey: { type: String, default: undefined },
  type: { type: String, enum: ["SALE", "PAYMENT"], required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  customerName: { type: String, default: "" },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  cashReceived: { type: Number, required: true, min: 0, default: 0 },
  creditAmount: { type: Number, required: true, min: 0, default: 0 },
  description: { type: String, default: "" },
  status: { type: String, enum: ["COMPLETED", "REVERSED"], default: "COMPLETED" },
  reversedAt: { type: Date, default: null }
}, { timestamps: true });

transactionSchema.index(
  { shop: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
transactionSchema.index({ shop: 1, createdAt: -1 });

export default mongoose.model("Transaction", transactionSchema);
