import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, trim: true, default: "" },
  notes: { type: String, trim: true, default: "", maxlength: 500 },
  outstandingBalance: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

customerSchema.index({ shop: 1, name: 1 });
export default mongoose.model("Customer", customerSchema);
