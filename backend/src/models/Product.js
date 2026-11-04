import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, trim: true, default: "General", maxlength: 60 },
  purchasePrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  minStock: { type: Number, min: 0, default: 5 },
  unit: { type: String, trim: true, default: "piece", maxlength: 20 }
}, { timestamps: true });

productSchema.index({ shop: 1, name: 1 }, { unique: true });
export default mongoose.model("Product", productSchema);
