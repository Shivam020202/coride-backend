import mongoose, { Document, Schema } from "mongoose";

export interface IRide extends Document {
  riderId: string;
  riderName: string;
  driverId: string;
  driverName: string;
  pickup: string;
  destination: string;
  distance: string;
  duration: string;
  price: number;
  status: "pending" | "picking_up" | "arrived" | "in_transit" | "completed" | "cancelled";
  riderRating: number;
  driverRating: number;
  womenOnly: boolean;
  paymentStatus: "pending" | "paid" | "failed";
  stripePaymentIntentId: string;
  rideType: "coride_x" | "premium";
  createdAt: Date;
  completedAt: Date;
}

const RideSchema: Schema = new Schema({
  riderId: { type: String, required: true },
  riderName: { type: String, default: "Rider" },
  driverId: { type: String, default: "" },
  driverName: { type: String, default: "" },
  pickup: { type: String, required: true },
  destination: { type: String, required: true },
  distance: { type: String, default: "" },
  duration: { type: String, default: "" },
  price: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "picking_up", "arrived", "in_transit", "completed", "cancelled"],
    default: "pending",
  },
  riderRating: { type: Number, default: 0 },
  driverRating: { type: Number, default: 0 },
  womenOnly: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  stripePaymentIntentId: { type: String, default: "" },
  rideType: { type: String, enum: ["coride_x", "premium"], default: "coride_x" },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

export default mongoose.model<IRide>("Ride", RideSchema);
