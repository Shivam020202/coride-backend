import { Router, Request, Response } from "express";
import User from "../models/User";
import Ride from "../models/Ride";
import DriverVerification from "../models/DriverVerification";
import { activeRides, activeRequests } from "../socket";

const router = Router();

// Dashboard stats
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRiders = await User.countDocuments({ role: "consumer" });
    const totalDrivers = await User.countDocuments({ role: "driver" });
    const totalRides = await Ride.countDocuments();
    const completedRides = await Ride.countDocuments({ status: "completed" });
    const cancelledRides = await Ride.countDocuments({ status: "cancelled" });
    const currentActiveRides = activeRides.length;
    const pendingRequests = activeRequests.length;

    const revenueResult = await Ride.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Revenue by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueByDay = await Ride.aggregate([
      { $match: { status: "completed", completedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          revenue: { $sum: "$price" },
          rides: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Rides by day (last 30 days)
    const ridesByDay = await Ride.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Users by day (last 30 days)
    const usersByDay = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Average rating
    const avgRatingResult = await Ride.aggregate([
      { $match: { driverRating: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$driverRating" } } },
    ]);
    const avgRating = avgRatingResult[0]?.avg || 0;

    res.json({
      totalUsers,
      totalRiders,
      totalDrivers,
      totalRides,
      completedRides,
      cancelledRides,
      currentActiveRides,
      pendingRequests,
      totalRevenue,
      avgRating: Math.round(avgRating * 10) / 10,
      revenueByDay,
      ridesByDay,
      usersByDay,
    });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// All users (with pagination + search)
router.get("/users", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || "";
    const role = (req.query.role as string) || "";

    const filter: any = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// All rides (with pagination + filters)
router.get("/rides", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "";
    const search = (req.query.search as string) || "";

    const filter: any = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { riderName: { $regex: search, $options: "i" } },
        { driverName: { $regex: search, $options: "i" } },
        { pickup: { $regex: search, $options: "i" } },
        { destination: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Ride.countDocuments(filter);
    const rides = await Ride.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ rides, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Active rides (from memory)
router.get("/active-rides", (_req: Request, res: Response): void => {
  res.json({ activeRides, activeRequests });
});

// Single user detail
router.get("/users/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) { res.status(404).json({ msg: "User not found" }); return; }

    const ridesAsRider = await Ride.countDocuments({ riderId: req.params.id });
    const ridesAsDriver = await Ride.countDocuments({ driverId: req.params.id });
    const totalSpent = await Ride.aggregate([
      { $match: { riderId: req.params.id, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const totalEarned = await Ride.aggregate([
      { $match: { driverId: req.params.id, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    res.json({
      user,
      ridesAsRider,
      ridesAsDriver,
      totalSpent: totalSpent[0]?.total || 0,
      totalEarned: totalEarned[0]?.total || 0,
    });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Delete user
router.delete("/users/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "User deleted" });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// ── Driver Verification Management ──

// All verification requests (with pagination + filters)
router.get("/verifications", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const status = (req.query.status as string) || "";
    const search = (req.query.search as string) || "";

    const filter: any = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { driverName: { $regex: search, $options: "i" } },
        { driverEmail: { $regex: search, $options: "i" } },
      ];
    }

    const total = await DriverVerification.countDocuments(filter);
    const verifications = await DriverVerification.find(filter)
      .sort({ submittedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ verifications, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Single verification detail
router.get("/verifications/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const verification = await DriverVerification.findById(req.params.id);
    if (!verification) {
      res.status(404).json({ msg: "Verification not found" });
      return;
    }
    res.json(verification);
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Approve a verification
router.post("/verifications/:id/approve", async (req: Request, res: Response): Promise<void> => {
  try {
    const verification = await DriverVerification.findById(req.params.id);
    if (!verification) {
      res.status(404).json({ msg: "Verification not found" });
      return;
    }

    verification.status = "approved";
    verification.reviewedAt = new Date();
    verification.reviewNote = req.body.note || "";
    verification.documents.forEach((doc) => {
      if (doc.status === "submitted") doc.status = "approved";
    });
    await verification.save();

    // Mark user as verified
    await User.findByIdAndUpdate(verification.driverId, { verified: true });

    res.json({ msg: "Driver approved", verification });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Reject a verification
router.post("/verifications/:id/reject", async (req: Request, res: Response): Promise<void> => {
  try {
    const verification = await DriverVerification.findById(req.params.id);
    if (!verification) {
      res.status(404).json({ msg: "Verification not found" });
      return;
    }

    verification.status = "rejected";
    verification.reviewedAt = new Date();
    verification.reviewNote = req.body.note || "Documents rejected. Please resubmit.";
    await verification.save();

    await User.findByIdAndUpdate(verification.driverId, { verified: false });

    res.json({ msg: "Driver rejected", verification });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

// Verification stats for dashboard
router.get("/verification-stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const pendingReview = await DriverVerification.countDocuments({ status: "pending_review" });
    const approved = await DriverVerification.countDocuments({ status: "approved" });
    const rejected = await DriverVerification.countDocuments({ status: "rejected" });
    const incomplete = await DriverVerification.countDocuments({ status: "incomplete" });

    res.json({ pendingReview, approved, rejected, incomplete });
  } catch (err) {
    console.error((err as Error).message);
    res.status(500).send("Server Error");
  }
});

export default router;
