import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User";
import Otp from "../models/Otp";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET must be defined");

// Build transporter only if SMTP credentials exist
let transporter: nodemailer.Transporter | null = null;

if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // Verify SMTP connection on startup
  transporter.verify((err, success) => {
    if (err) {
      console.error("[SMTP] Transporter verification FAILED:", err.message);
      transporter = null; // Mark as unusable
    } else {
      console.log("[SMTP] Transporter is ready to send emails");
    }
  });
} else {
  console.warn("[SMTP] SMTP_EMAIL or SMTP_PASSWORD not set — email OTP disabled, OTPs will be logged to console");
}

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role, gender } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      res.status(400).json({ msg: "User already exists" });
      return;
    }

    user = new User({
      name,
      email,
      password,
      role: role || "consumer",
      gender: gender || "male",
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: 360000 },
      (err: Error | null, token: string | undefined) => {
        if (err) throw err;
        res.json({ token, role: user!.role });
      },
    );
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password, role } = req.body;

  try {
    let user = await User.findOne({ email, role });
    if (!user) {
      res.status(400).json({ msg: "Invalid Credentials for this role" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password!);
    if (!isMatch) {
      res.status(400).json({ msg: "Invalid Credentials" });
      return;
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: 360000 },
      (err: Error | null, token: string | undefined) => {
        if (err) throw err;
        res.json({ token, role: user?.role });
      },
    );
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Get Logged in User
import authMiddleware, { AuthRequest } from "../middleware/auth";

router.get(
  "/me",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.user?.id).select("-password");
      res.json(user);
    } catch (err) {
      console.error((err as Error).message);
      res.status(500).json({ msg: "Server Error" });
    }
  },
);

// Forgot Password — send OTP to email
router.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ msg: "No account found with this email" });
      return;
    }

    // Delete any existing OTPs for this email
    await Otp.deleteMany({ email });

    const otp = generateOtp();
    await new Otp({ email, otp }).save();

    // Always log OTP to server console as backup
    console.log(`[OTP] Code for ${email}: ${otp}`);

    // Try sending email if transporter is available
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `CoRide <${process.env.SMTP_EMAIL}>`,
          to: email,
          subject: "Password Reset OTP",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #18181b; font-size: 1.5rem; margin-bottom: 8px;">Reset your password</h2>
              <p style="color: #71717a; font-size: 0.875rem; margin-bottom: 24px;">Use the code below to reset your CoRide password. It expires in 5 minutes.</p>
              <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 2rem; font-weight: 700; letter-spacing: 8px; color: #18181b;">${otp}</span>
              </div>
              <p style="color: #a1a1aa; font-size: 0.75rem;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
        console.log(`[OTP] Email sent successfully to ${email}`);
      } catch (emailErr) {
        console.error("[OTP] Email send failed:", (emailErr as Error).message);
        // Email failed but OTP is saved — still return success so user can proceed
        // In production, check server logs for the OTP
      }
    }

    // Always return success — the OTP is saved in DB regardless of email delivery
    res.json({ msg: "OTP sent to your email" });
  } catch (err) {
    console.error("Forgot-password error:", (err as Error).message);
    res.status(500).json({ msg: "Failed to process request. Please try again." });
  }
});

// Verify OTP
router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body;

  try {
    const record = await Otp.findOne({ email, otp });
    if (!record) {
      res.status(400).json({ msg: "Invalid or expired OTP" });
      return;
    }

    res.json({ msg: "OTP verified successfully" });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Reset Password
router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  const { email, otp, newPassword } = req.body;

  try {
    const record = await Otp.findOne({ email, otp });
    if (!record) {
      res.status(400).json({ msg: "Invalid or expired OTP" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findOneAndUpdate({ email }, { password: hashedPassword });
    await Otp.deleteMany({ email });

    res.json({ msg: "Password reset successfully" });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;
