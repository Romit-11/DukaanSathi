import mongoose from "mongoose";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import StockMovement from "../models/StockMovement.js";
import Transaction from "../models/Transaction.js";

export async function getDashboardSummary(req, res, next) {
  try {
    const shop = req.userId;
    const [productCount, customerCount, lowStock, recentMovements, profitResult] = await Promise.all([
      Product.countDocuments({ shop }),
      Customer.countDocuments({ shop }),
      Product.find({ shop, $expr: { $lte: ["$quantity", "$minStock"] } })
        .sort({ quantity: 1 }).limit(6).select("name quantity minStock unit").lean(),
      StockMovement.find({ shop }).sort({ createdAt: -1 }).limit(6).lean(),
      Transaction.aggregate([
        { $match: { shop: new mongoose.Types.ObjectId(shop), type: "SALE", status: "COMPLETED" } },
        { $unwind: "$items" },
        { $match: { "items.unitCost": { $exists: true, $ne: null } } },
        { $group: {
          _id: null,
          grossProfit: {
            $sum: {
              $subtract: [
                { $ifNull: ["$items.lineTotal", 0] },
                { $multiply: [
                  { $ifNull: ["$items.unitCost", 0] },
                  { $ifNull: ["$items.quantity", 0] }
                ] }
              ]
            }
          }
        } }
      ])
    ]);

    res.json({
      success: true,
      summary: { productCount, customerCount, lowStockCount: lowStock.length, grossProfit: Number(profitResult[0]?.grossProfit || 0) },
      lowStock,
      recentMovements
    });
  } catch (error) { next(error); }
}
