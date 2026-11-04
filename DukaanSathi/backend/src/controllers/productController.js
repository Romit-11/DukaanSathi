import { z } from "zod";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";

const productSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().max(60).optional().default("General"),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0).optional().default(5),
  unit: z.string().trim().max(20).optional().default("piece")
});

export async function listProducts(req, res, next) {
  try {
    const products = await Product.find({ shop: req.userId }).sort({ name: 1 }).lean();
    res.json({ success: true, products });
  } catch (error) { next(error); }
}

export async function createProduct(req, res, next) {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });

    const product = await Product.create({ ...parsed.data, shop: req.userId });
    if (product.quantity > 0) {
      await StockMovement.create({
        shop: req.userId, product: product._id, productName: product.name,
        change: product.quantity, quantityAfter: product.quantity, reason: "OPENING_STOCK"
      });
    }
    res.status(201).json({ success: true, product });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A product with this name already exists in your shop." });
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, shop: req.userId },
      { $set: parsed.data },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    res.json({ success: true, product });
  } catch (error) { next(error); }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, shop: req.userId });
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    res.json({ success: true, message: "Product deleted." });
  } catch (error) { next(error); }
}

export async function adjustStock(req, res, next) {
  try {
    const schema = z.object({
      change: z.coerce.number().int().refine(value => value !== 0, "Change cannot be zero."),
      reason: z.enum(["RESTOCK", "CORRECTION"]).default("RESTOCK")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });

    const { change, reason } = parsed.data;
    const filter = { _id: req.params.id, shop: req.userId };
    if (change < 0) filter.quantity = { $gte: Math.abs(change) };

    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { quantity: change } },
      { new: true, runValidators: true }
    );

    if (!product) return res.status(400).json({ success: false, message: "Product not found or stock cannot go below zero." });

    await StockMovement.create({
      shop: req.userId, product: product._id, productName: product.name,
      change, quantityAfter: product.quantity, reason
    });

    res.json({ success: true, product, message: "Stock updated." });
  } catch (error) { next(error); }
}
