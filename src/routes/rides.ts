import { Router, Response } from "express";
import authMiddleware, { AuthRequest } from "../middleware/auth";

const router = Router();

// Generate dynamic mock rides for the logged-in user to make the app feel "alive".
router.get("/history", authMiddleware, (req: AuthRequest, res: Response) => {
  const rides = [
    {
      id: "1",
      destination: "Central Park, New York",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
      type: "CoRide X",
      price: 18.25,
      rating: 5,
    },
    {
      id: "2",
      destination: "123 Main Street, Apt 4B",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
      type: "Premium",
      price: 45.0,
      rating: 5,
    },
    {
      id: "3",
      destination: "JFK International Airport",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
      type: "CoRide X",
      price: 62.5,
      rating: 4,
    },
    {
      id: "4",
      destination: "Times Square",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
      type: "CoRide X",
      price: 12.8,
      rating: 5,
    },
    {
      id: "5",
      destination: "Empire State Building",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), // 14 days ago
      type: "Premium",
      price: 28.4,
      rating: 5,
    },
  ];

  res.json(rides);
});

export default router;
