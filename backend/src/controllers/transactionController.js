import mongoose from "mongoose";
import { z } from "zod";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Transaction from "../models/Transaction.js";
import StockMovement from "../models/StockMovement.js";

const saleSchema = z.object({
  customerId: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().positive().max(100000)
  })).min(1).max(50),
  cashReceived: z.coerce.number().min(0),
  description: z.string().trim().max(300).optional().default("")
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  description: z.string().trim().max(300).optional().default("Payment received")
});

const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;

export async function createSale(req, res, next) {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid sale details." });
  }

  const { customerId, items, cashReceived, description } = parsed.data;
  const idempotencyKey = req.get("Idempotency-Key");
  if (idempotencyKey && idempotencyKey.length > 100) {
    return res.status(400).json({ success: false, message: "Idempotency key is too long." });
  }

  if (customerId && !mongoose.isValidObjectId(customerId)) {
    return res.status(400).json({ success: false, message: "Invalid customer." });
  }
  if (items.some(item => !mongoose.isValidObjectId(item.productId))) {
    return res.status(400).json({ success: false, message: "Invalid product in sale." });
  }

  // Combine duplicate product lines before calculating stock changes.
  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }

  const session = await mongoose.startSession();
  try {
    let createdSale;
    await session.withTransaction(async () => {
      if (idempotencyKey) {
        const existing = await Transaction.findOne({
          shop: req.userId, idempotencyKey
        }).session(session);
        if (existing) {
          createdSale = existing;
          return;
        }
      }

      let customer = null;
      if (customerId) {
        customer = await Customer.findOne({ _id: customerId, shop: req.userId }).session(session);
        if (!customer) throw Object.assign(new Error("Customer not found in your shop."), { statusCode: 404 });
      }

      const productIds = [...quantities.keys()];
      const products = await Product.find({
        _id: { $in: productIds },
        shop: req.userId
      }).session(session);

      if (products.length !== productIds.length) {
        throw Object.assign(new Error("One or more products were not found in your shop."), { statusCode: 404 });
      }

      const productMap = new Map(products.map(product => [product._id.toString(), product]));
      const transactionItems = [];
      let totalAmount = 0;

      for (const [productId, quantity] of quantities.entries()) {
        const product = productMap.get(productId);
        if (product.quantity < quantity) {
          throw Object.assign(new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}.`), { statusCode: 409 });
        }

        const lineTotal = roundMoney(product.sellingPrice * quantity);
        totalAmount = roundMoney(totalAmount + lineTotal);
        transactionItems.push({
          product: product._id,
          productName: product.name,
          quantity,
          unitPrice: product.sellingPrice,
          unitCost: product.purchasePrice,
          lineTotal
        });
      }

      if (cashReceived > totalAmount) {
        throw Object.assign(new Error("Cash received cannot exceed the sale total."), { statusCode: 400 });
      }

      const creditAmount = roundMoney(totalAmount - cashReceived);
      if (creditAmount > 0 && !customer) {
        throw Object.assign(new Error("Select a customer to record the unpaid amount as credit."), { statusCode: 400 });
      }

      for (const line of transactionItems) {
        const updated = await Product.findOneAndUpdate(
          { _id: line.product, shop: req.userId, quantity: { $gte: line.quantity } },
          { $inc: { quantity: -line.quantity } },
          { new: true, session, runValidators: true }
        );
        if (!updated) {
          throw Object.assign(new Error(`Stock changed while processing ${line.productName}. Please retry.`), { statusCode: 409 });
        }

        await StockMovement.create([{
          shop: req.userId,
          product: line.product,
          productName: line.productName,
          change: -line.quantity,
          quantityAfter: updated.quantity,
          reason: "SALE"
        }], { session });
      }

      if (customer && creditAmount > 0) {
        customer.outstandingBalance = roundMoney(customer.outstandingBalance + creditAmount);
        await customer.save({ session });
      }

      const [sale] = await Transaction.create([{
        shop: req.userId,
        idempotencyKey: idempotencyKey || undefined,
        type: "SALE",
        customer: customer?._id || null,
        customerName: customer?.name || "",
        items: transactionItems,
        totalAmount,
        cashReceived: roundMoney(cashReceived),
        creditAmount,
        description,
        status: "COMPLETED"
      }], { session });

      createdSale = sale;
    });

    return res.status(201).json({
      success: true,
      message: "Sale recorded and stock updated.",
      transaction: createdSale
    });
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing = await Transaction.findOne({ shop: req.userId, idempotencyKey });
      if (existing) return res.json({ success: true, message: "This sale was already recorded.", transaction: existing });
    }
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

export async function receivePayment(req, res, next) {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Invalid payment." });
  }
  if (!mongoose.isValidObjectId(req.params.customerId)) {
    return res.status(400).json({ success: false, message: "Invalid customer." });
  }

  const session = await mongoose.startSession();
  try {
    let payment;
    await session.withTransaction(async () => {
      const customer = await Customer.findOne({
        _id: req.params.customerId,
        shop: req.userId
      }).session(session);

      if (!customer) throw Object.assign(new Error("Customer not found."), { statusCode: 404 });
      if (parsed.data.amount > customer.outstandingBalance) {
        throw Object.assign(new Error(`Payment exceeds outstanding balance of ₹${customer.outstandingBalance.toFixed(2)}.`), { statusCode: 400 });
      }

      customer.outstandingBalance = roundMoney(customer.outstandingBalance - parsed.data.amount);
      await customer.save({ session });

      const [created] = await Transaction.create([{
        shop: req.userId,
        type: "PAYMENT",
        customer: customer._id,
        customerName: customer.name,
        totalAmount: roundMoney(parsed.data.amount),
        cashReceived: roundMoney(parsed.data.amount),
        creditAmount: 0,
        description: parsed.data.description,
        status: "COMPLETED"
      }], { session });

      payment = created;
    });

    res.status(201).json({
      success: true,
      message: "Customer payment recorded.",
      transaction: payment
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

export async function listTransactions(req, res, next) {
  try {
    const transactions = await Transaction.find({ shop: req.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, transactions });
  } catch (error) { next(error); }
}
