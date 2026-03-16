import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET must be defined");

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
    res.status(500).send("Server Error");
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
    res.status(500).send("Server Error");
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
      res.status(500).send("Server Error");
    }
  },
);

export default router;
