import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";

const registerSchema = z.object({
  shopName: z.string().trim().min(2).max(100),
  ownerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72)
});

function createToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: userId.toString(),
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
}

function setAuthCookie(res, token) {
  res.cookie("dukaansathi_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function publicUser(user) {
  return {
    id: user._id,
    shopName: user.shopName,
    ownerName: user.ownerName,
    email: user.email,
    preferredLanguage: user.preferredLanguage
  };
}

export async function register(req, res, next) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid registration details."
      });
    }

    const { shopName, ownerName, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      shopName,
      ownerName,
      email: normalizedEmail,
      passwordHash
    });

    const token = createToken(user._id);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: "Your shop account has been created.",
      user: publicUser(user)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email and password."
      });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password."
      });
    }

    const passwordMatches = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password."
      });
    }

    setAuthCookie(res, createToken(user._id));

    return res.json({
      success: true,
      message: "Welcome back.",
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.clearCookie("dukaansathi_token", { path: "/" });
      return res.status(401).json({
        success: false,
        message: "Account not found. Please log in again."
      });
    }

    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export function logout(req, res) {
  res.clearCookie("dukaansathi_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/"
  });


  return res.json({ success: true, message: "You have been logged out." });
}
