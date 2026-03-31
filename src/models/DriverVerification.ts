import mongoose, { Document, Schema } from "mongoose";

export interface IDocumentItem {
  name: string;
  required: boolean;
  status: "pending" | "submitted" | "approved" | "rejected";
  fileUrl?: string;
  submittedAt?: Date;
  note?: string;
}

export interface IDriverVerification extends Document {
  driverId: string;
  driverName: string;
  driverEmail: string;
  status: "incomplete" | "pending_review" | "approved" | "rejected";
  documents: IDocumentItem[];
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
}

const DocumentItemSchema = new Schema({
  name: { type: String, required: true },
  required: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ["pending", "submitted", "approved", "rejected"],
    default: "pending",
  },
  fileUrl: { type: String },
  submittedAt: { type: Date },
  note: { type: String },
});

const DriverVerificationSchema: Schema = new Schema({
  driverId: { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  driverEmail: { type: String, required: true },
  status: {
    type: String,
    enum: ["incomplete", "pending_review", "approved", "rejected"],
    default: "incomplete",
  },
  documents: [DocumentItemSchema],
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IDriverVerification>(
  "DriverVerification",
  DriverVerificationSchema
);
