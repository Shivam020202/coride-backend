import { Router, Response } from "express";
import Stripe from "stripe";
import Ride from "../models/Ride";
import authMiddleware, { AuthRequest } from "../middleware/auth";

const router = Router();

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Create a Payment Intent for a ride
router.post(
  "/create-payment-intent",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!stripe) {
      res.status(503).json({ msg: "Stripe is not configured" });
      return;
    }
    try {
      const { amount, rideId } = req.body;

      if (!amount || amount <= 0) {
        res.status(400).json({ msg: "Invalid amount" });
        return;
      }

      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
        metadata: {
          rideId: rideId || "",
          userId: req.user?.id || "",
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (err) {
      console.error("Stripe error:", (err as Error).message);
      res.status(500).json({ msg: "Payment failed", error: (err as Error).message });
    }
  }
);

// Confirm payment and mark ride as paid
router.post(
  "/confirm-payment",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!stripe) {
      res.status(503).json({ msg: "Stripe is not configured" });
      return;
    }
    try {
      const { paymentIntentId, rideId } = req.body;

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === "succeeded") {
        const userId = req.user?.id;
        let updated = false;

        // Try to find by rideId first
        if (rideId) {
          const result = await Ride.findOneAndUpdate(
            { _id: rideId },
            { paymentStatus: "paid", stripePaymentIntentId: paymentIntentId }
          );
          if (result) updated = true;
        }

        // Fallback: find the most recent completed but unpaid ride for this user
        if (!updated && userId) {
          await Ride.findOneAndUpdate(
            { riderId: userId, status: "completed", paymentStatus: "pending" },
            { paymentStatus: "paid", stripePaymentIntentId: paymentIntentId },
            { sort: { completedAt: -1 } }
          );
        }

        res.json({ msg: "Payment confirmed", status: "paid" });
      } else {
        res.status(400).json({
          msg: "Payment not completed",
          status: paymentIntent.status,
        });
      }
    } catch (err) {
      console.error("Payment confirmation error:", (err as Error).message);
      res.status(500).json({ msg: "Error confirming payment" });
    }
  }
);

// Get Stripe publishable key
router.get("/config", (_req, res: Response): void => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  });
});

export default router;
