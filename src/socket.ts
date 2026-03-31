import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import Ride from "./models/Ride";
import User from "./models/User";

export let io: Server;

// Ride states simulation in memory for real-time
// In a real app, this should go into a database like Redis/MongoDB
export const activeRequests: any[] = [];
export const activeRides: any[] = [];

// Track drivers and their gender for womenOnly filtering
// Map of userId -> { socketId, gender }
const driverRegistry = new Map<string, { socketId: string; gender: string }>();

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log("Client connected:", socket.id);

    // Register a specific user (rider or driver) using their token/userId
    socket.on("register", async (data: { userId: string; role: string; gender?: string }) => {
      // Join a room based on userId for private messaging
      socket.join(data.userId);

      if (data.role === "driver") {
        // Check if driver is verified before adding to driver room
        try {
          const driver = await User.findById(data.userId);
          if (!driver || !driver.verified) {
            console.log(`Driver ${data.userId} is not verified — not joining driver room`);
            // Still join userId room for private messages, but NOT the "driver" room
            return;
          }
        } catch (err) {
          console.error("Error checking driver verification:", err);
          return;
        }

        // Verified driver — join driver room
        socket.join(data.role);
        driverRegistry.set(data.userId, {
          socketId: socket.id,
          gender: data.gender || "male",
        });
        console.log(`Driver ${data.userId} registered with gender: ${data.gender || "male"}`);
      } else {
        // Riders join role room directly
        socket.join(data.role);
      }
      console.log(`User ${data.userId} registered as ${data.role}`);
    });

    // Rider requests a ride
    socket.on("requestRide", (rideData: any) => {
      console.log("[Socket] requestRide received from:", rideData.userId, rideData);
      const newRequest = {
        id: "req_" + Date.now().toString(),
        userId: rideData.userId,
        user: rideData.user,
        pickup: rideData.pickup,
        destination: rideData.destination,
        price: rideData.price || 25.5,
        distance: rideData.distance || "12 miles",
        time: rideData.duration || rideData.time || "20 min",
        status: "pending",
        womenOnly: rideData.womenOnly || false,
        createdAt: new Date(),
      };

      activeRequests.push(newRequest);

      if (newRequest.womenOnly) {
        // Only notify female drivers
        const femaleDriverIds = [...driverRegistry.entries()]
          .filter(([, info]) => info.gender === "female")
          .map(([userId]) => userId);

        console.log(`[Socket] womenOnly request — notifying ${femaleDriverIds.length} female driver(s)`);
        femaleDriverIds.forEach((userId) => {
          io.to(userId).emit("newRideRequest", newRequest);
        });
      } else {
        // Broadcast to all online drivers
        const driverRoom = io.sockets.adapter.rooms.get("driver");
        console.log("[Socket] Driver room size:", driverRoom?.size || 0);
        io.to("driver").emit("newRideRequest", newRequest);
        console.log("[Socket] Emitted newRideRequest to driver room");
      }

      // Let rider know it was sent successfully
      socket.emit("rideRequested", newRequest);
    });

    // Driver accepts a ride
    socket.on("acceptRide", (data: any) => {
      console.log("[Socket] acceptRide received:", data);
      const idx = activeRequests.findIndex((r) => r.id === data.requestId);
      if (idx !== -1) {
        const req = activeRequests[idx];
        activeRequests.splice(idx, 1); // Remove from pending

        const activeRide = {
          ...req,
          ...data,
          status: "picking_up",
          driverLocation: { lat: 40.7128, lng: -74.006 },
        };
        activeRides.push(activeRide);

        // Notify all drivers to remove it
        io.to("driver").emit("removeRideRequest", data.requestId);

        // Check that the rider's userId room exists
        const riderRoom = io.sockets.adapter.rooms.get(req.userId);
        console.log("[Socket] Rider room for", req.userId, "size:", riderRoom?.size || 0);

        // Notify specific rider
        io.to(req.userId).emit("rideAccepted", activeRide);
        console.log("[Socket] Emitted rideAccepted to rider:", req.userId);

        // Also emit to the accepting socket directly in case rider is on same connection
        socket.emit("rideAcceptSuccess", activeRide);
        console.log("[Socket] Emitted rideAcceptSuccess to driver socket");
      } else {
        console.log("[Socket] acceptRide: request not found for id:", data.requestId);
      }
    });

    // Driver updates location
    socket.on("updateLocation", (data: { rideId: string; location: any }) => {
      const ride = activeRides.find((r) => r.id === data.rideId);
      if (ride) {
        ride.driverLocation = data.location;
        // Broadcast location to the specific rider
        io.to(ride.userId).emit("driverLocationUpdate", data.location);
      }
    });

    // Driver updates ride status
    socket.on(
      "updateRideStatus",
      (data: { rideId: string; status: string }) => {
        const ride = activeRides.find((r) => r.id === data.rideId);
        if (ride) {
          ride.status = data.status;
          io.to(ride.userId).emit("rideStatusUpdate", data.status);

          if (data.status === "completed") {
            // Persist to database
            new Ride({
              riderId: ride.userId,
              riderName: ride.user || "Rider",
              driverId: ride.driverId || "",
              driverName: ride.driverName || "",
              pickup: ride.pickup,
              destination: ride.destination,
              distance: ride.distance || "",
              duration: ride.time || "",
              price: ride.price || 0,
              status: "completed",
              womenOnly: ride.womenOnly || false,
              completedAt: new Date(),
            }).save().catch((err: any) => console.error("Error saving ride:", err));

            // Clean up from memory
            const index = activeRides.indexOf(ride);
            if (index > -1) activeRides.splice(index, 1);
          }
        }
      },
    );

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      // Remove from driver registry
      for (const [userId, info] of driverRegistry.entries()) {
        if (info.socketId === socket.id) {
          driverRegistry.delete(userId);
          console.log(`[Socket] Driver ${userId} removed from registry`);
          break;
        }
      }
    });

    // ── Live Ride Sharing ──────────────────────────────────────────────────────

    // Sharer starts broadcasting — joins a private room keyed by their share token
    socket.on("startSharing", (data: { token: string }) => {
      socket.join(`share_${data.token}`);
      console.log(`[Socket] Sharer joined room share_${data.token}`);
    });

    // Sharer emits their live location — server relays it to everyone tracking
    socket.on("broadcastLocation", (data: { token: string; lat: number; lng: number }) => {
      io.to(`share_${data.token}`).emit("liveLocation", { lat: data.lat, lng: data.lng });
    });

    // Receiver joins tracking room to receive live location updates
    socket.on("trackRide", (data: { token: string }) => {
      socket.join(`share_${data.token}`);
      console.log(`[Socket] Tracker joined room share_${data.token}`);
    });
  });
};
