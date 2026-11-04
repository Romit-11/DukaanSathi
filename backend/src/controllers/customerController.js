import { z } from "zod";
import Customer from "../models/Customer.js";

const customerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(500).optional().default("")
});

export async function listCustomers(req, res, next) {
  try {
    const customers = await Customer.find({ shop: req.userId }).sort({ name: 1 }).lean();
    res.json({ success: true, customers });
  } catch (error) { next(error); }
}

export async function createCustomer(req, res, next) {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    const customer = await Customer.create({ ...parsed.data, shop: req.userId });
    res.status(201).json({ success: true, customer });
  } catch (error) { next(error); }
}

export async function updateCustomer(req, res, next) {
  try {
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.userId },
      { $set: parsed.data },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found." });
    res.json({ success: true, customer });
  } catch (error) { next(error); }
}

export async function deleteCustomer(req, res, next) {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, shop: req.userId });
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found." });
    res.json({ success: true, message: "Customer deleted." });
  } catch (error) { next(error); }
}
