import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import requireAuth from "./middleware/requireAuth.js";

const app = express();

// Render runs the service behind a reverse proxy.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." }
});

app.get("/api/health", (req, res) => res.json({ success: true, message: "DukaanSathi API is running." }));
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", requireAuth, productRoutes);
app.use("/api/customers", requireAuth, customerRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/transactions", requireAuth, transactionRoutes);
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many voice requests. Please wait a minute and try again." }
});
app.use("/api/voice", requireAuth, voiceLimiter, voiceRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found." }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Something went wrong on the server." });
});

export default app;
