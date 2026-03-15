import { Router, Response } from "express";
import authMiddleware, { AuthRequest } from "../middleware/auth";

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

// Generate dynamic mock history for driver
router.get("/history", authMiddleware, (req: AuthRequest, res: Response) => {
  const history = [
    {
      id: "1",
      user: "Dwight Schrute",
      destination: "Beet Farm",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      type: "CoRide X",
      earnings: 15.25,
      rating: 5,
    },
    {
      id: "2",
      user: "Angela Martin",
      destination: "Cat Hospital",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      type: "Premium",
      earnings: 30.0,
      rating: 4,
    },
    {
      id: "3",
      user: "Stanley Hudson",
      destination: "Pretzel Stand",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      type: "CoRide X",
      earnings: 8.5,
      rating: 5,
    },
  ];

  res.json({ history, totalEarnings: 53.75 });
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
