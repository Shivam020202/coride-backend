import { Router, Response } from "express";
import Stripe from "stripe";
import Ride from "../models/Ride";
import authMiddleware, { AuthRequest } from "../middleware/auth";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Create a Payment Intent for a ride
router.post(
  "/create-payment-intent",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { amount, rideId } = req.body;

      if (!amount || amount <= 0) {
        res.status(400).json({ msg: "Invalid amount" });
        return;
      }

      // Amount should be in cents for Stripe
      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        metadata: {
          rideId: rideId || "",
          userId: req.user?.id || "",
        },
        automatic_payment_methods: {
          enabled: true,
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
    try {
      const { paymentIntentId, rideId } = req.body;

      // Verify the payment intent status with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === "succeeded") {
        // Update ride payment status if we have a rideId
        if (rideId) {
          await Ride.findOneAndUpdate(
            { _id: rideId },
            {
              paymentStatus: "paid",
              stripePaymentIntentId: paymentIntentId,
            }
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

// Get Stripe publishable key (so frontend doesn't hardcode it)
router.get("/config", (_req, res: Response): void => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

export default router;
