import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  change: { type: Number, required: true },
  quantityAfter: { type: Number, required: true, min: 0 },
  reason: { type: String, enum: ["OPENING_STOCK", "RESTOCK", "CORRECTION", "SALE"], default: "CORRECTION" }
}, { timestamps: true });

export default mongoose.model("StockMovement", stockMovementSchema);
