import { Router, Response } from "express";
import authMiddleware, { AuthRequest } from "../middleware/auth";
import Ride from "../models/Ride";

const router = Router();

// Fetch completed rides for the logged-in rider from the database
router.get("/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rides = await Ride.find({ riderId: userId, status: "completed" })
      .sort({ completedAt: -1 })
      .limit(50)
      .lean();

    const formatted = rides.map((ride) => ({
      id: ride._id,
      destination: ride.destination,
      pickup: ride.pickup,
      date: (ride.completedAt || ride.createdAt || new Date()).toISOString(),
      type: ride.rideType === "premium" ? "Premium" : "CoRide X",
      price: ride.price,
      rating: ride.driverRating || 0,
      driverName: ride.driverName || "Driver",
      distance: ride.distance || "",
      duration: ride.duration || "",
      paymentStatus: ride.paymentStatus,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching ride history:", err);
    res.status(500).json({ msg: "Failed to fetch ride history" });
  }
});

export default router;
