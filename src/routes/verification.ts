import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import DriverVerification from "../models/DriverVerification";
import User from "../models/User";
import authMiddleware, { AuthRequest } from "../middleware/auth";

const router = Router();

// Document checklist for drivers
const DOCUMENT_CHECKLIST = [
  { name: "Driver's Licence (Front)", required: true },
  { name: "Driver's Licence (Back)", required: true },
  { name: "Anti-touting Education", required: true },
  { name: "Working With Children Check", required: false },
  { name: "Terms and Conditions", required: true },
  { name: "Driving Record", required: true },
  { name: "National Identity Card (Passport / Citizenship / BirthCert / ImmiCard)", required: true },
  { name: "Profile Picture", required: true },
  { name: "VEVO Check", required: true },
  { name: "Australian Business Number (ABN)", required: true },
  { name: "Criminal Background Check", required: true },
  { name: "Passenger Transport Licence Code", required: true },
  { name: "Preventing Conflict Education", required: true },
];

// Multer storage config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Only images and PDFs are allowed"));
  },
});

// Get verification status for current driver
router.get("/status", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    let verification = await DriverVerification.findOne({ driverId: userId });

    if (!verification) {
      // Create a new verification record with the checklist
      const user = await User.findById(userId);
      verification = new DriverVerification({
        driverId: userId,
        driverName: user?.name || "",
        driverEmail: user?.email || "",
        status: "incomplete",
        documents: DOCUMENT_CHECKLIST.map((doc) => ({
          name: doc.name,
          required: doc.required,
          status: "pending",
        })),
      });
      await verification.save();
    }

    res.json(verification);
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Upload a document for a specific checklist item
router.post(
  "/upload/:docName",
  authMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const docName = decodeURIComponent(req.params.docName as string);
      const file = req.file;

      if (!file) {
        res.status(400).json({ msg: "No file uploaded" });
        return;
      }

      const verification = await DriverVerification.findOne({ driverId: userId });
      if (!verification) {
        res.status(404).json({ msg: "Verification record not found" });
        return;
      }

      const doc = verification.documents.find((d) => d.name === docName);
      if (!doc) {
        res.status(404).json({ msg: "Document item not found" });
        return;
      }

      doc.status = "submitted";
      doc.fileUrl = `/uploads/${file.filename}`;
      doc.submittedAt = new Date();

      await verification.save();
      res.json({ msg: "Document uploaded", document: doc });
    } catch (err) {
      console.error((err as Error).message);
      res.status(500).send("Server Error");
    }
  }
);

// Accept Terms and Conditions (no file needed)
router.post("/accept/:docName", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const docName = decodeURIComponent(req.params.docName as string);

    const verification = await DriverVerification.findOne({ driverId: userId });
    if (!verification) {
      res.status(404).json({ msg: "Verification record not found" });
      return;
    }

    const doc = verification.documents.find((d) => d.name === docName);
    if (!doc) {
      res.status(404).json({ msg: "Document item not found" });
      return;
    }

    doc.status = "submitted";
    doc.submittedAt = new Date();

    await verification.save();
    res.json({ msg: "Accepted", document: doc });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Submit all documents for review
router.post("/submit", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const verification = await DriverVerification.findOne({ driverId: userId });

    if (!verification) {
      res.status(404).json({ msg: "Verification record not found" });
      return;
    }

    // Check that all required docs are submitted
    const unsubmittedRequired = verification.documents.filter(
      (d) => d.required && d.status === "pending"
    );
    if (unsubmittedRequired.length > 0) {
      res.status(400).json({
        msg: "Please complete all required documents before submitting",
        missing: unsubmittedRequired.map((d) => d.name),
      });
      return;
    }

    verification.status = "pending_review";
    verification.submittedAt = new Date();
    await verification.save();

    res.json({ msg: "Verification submitted for review" });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

export default router;
