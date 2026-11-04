import { Router } from "express";
import {
  listCustomers, createCustomer, updateCustomer, deleteCustomer
} from "../controllers/customerController.js";

const router = Router();
router.get("/", listCustomers);
router.post("/", createCustomer);
router.patch("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);
export default router;
