import { Server as SocketIOServer } from "socket.io";
import { Redis } from "ioredis";
import { createLogger } from "@repo/shared";
import type { Server as HttpServer } from "http";

const logger = createLogger("api-gateway");

let io: SocketIOServer | null = null;

export function createSocketServer(httpServer: HttpServer, redisUrl: string, corsOrigins: string) {
  const subscriber = new Redis(redisUrl);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins.split(","),
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    logger.info("Client connected", { socketId: socket.id });

    socket.on("disconnect", (reason) => {
      logger.info("Client disconnected", { socketId: socket.id, reason });
    });
  });

  // Subscribe to Redis ticket events and broadcast to all connected clients
  subscriber.subscribe("ticket-events", (err) => {
    if (err) {
      logger.error("Failed to subscribe to ticket-events", { error: err.message });
      return;
    }
    logger.info("Subscribed to ticket-events channel");
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const event = JSON.parse(message);
      io?.emit("ticket-event", event);
    } catch (err) {
      logger.error("Error broadcasting event", { error: (err as Error).message });
    }
  });

  return io;
}

export function getIO() {
  return io;
}
