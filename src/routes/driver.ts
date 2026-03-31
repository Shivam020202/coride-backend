import { Router, Response } from "express";
import authMiddleware, { AuthRequest } from "../middleware/auth";
import Ride from "../models/Ride";

const router = Router();

// Generate dynamic mock ride requests for the driver to accept
router.get("/requests", authMiddleware, (req: AuthRequest, res: Response) => {
  const requests = [
    {
      id: "req1",
      user: "Michael Scott",
      pickup: "Dunder Mifflin, Scranton",
      destination: "Schrute Farms",
      price: 25.5,
      distance: "12 miles",
      time: "20 min",
    },
    {
      id: "req2",
      user: "Jim Halpert",
      pickup: "Stamford",
      destination: "Scranton",
      price: 120.0,
      distance: "150 miles",
      time: "2h 30m",
    },
    {
      id: "req3",
      user: "Pam Beesly",
      pickup: "Art School, NY",
      destination: "Scranton",
      price: 105.75,
      distance: "130 miles",
      time: "2h 15m",
    },
  ];
  res.json(requests);
});

// Fetch completed rides for the logged-in driver from the database
router.get("/history", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const driverId = req.user?.id;
    const rides = await Ride.find({ driverId, status: "completed" })
      .sort({ completedAt: -1 })
      .limit(50)
      .lean();

    const history = rides.map((ride) => ({
      id: ride._id,
      user: ride.riderName || "Rider",
      destination: ride.destination,
      pickup: ride.pickup,
      date: (ride.completedAt || ride.createdAt || new Date()).toISOString(),
      type: ride.price >= 40 ? "Premium" : "CoRide X",
      earnings: ride.price,
      rating: ride.riderRating || 0,
      distance: ride.distance || "",
      duration: ride.duration || "",
      paymentStatus: ride.paymentStatus,
    }));

    const totalEarnings = history.reduce((sum, h) => sum + h.earnings, 0);

    res.json({ history, totalEarnings });
  } catch (err) {
    console.error("Error fetching driver history:", err);
    res.status(500).json({ msg: "Failed to fetch driver history" });
  }
});

// Accept a ride API mock
router.post("/accept", authMiddleware, (req: AuthRequest, res: Response) => {
  const { requestId } = req.body;

  if (!requestId) {
    return res.status(400).json({ msg: "Request ID is required" });
  }

  res.json({
    msg: "Ride accepted successfully!",
    ride: {
      id: requestId,
      status: "accepted",
      driverId: req.user?.id,
    },
  });
});

export default router;
