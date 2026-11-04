import { Router } from "express";
import { createSale, receivePayment, listTransactions } from "../controllers/transactionController.js";

const router = Router();
router.get("/", listTransactions);
router.post("/sales", createSale);
router.post("/customers/:customerId/payments", receivePayment);
export default router;
