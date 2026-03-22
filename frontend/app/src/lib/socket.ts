import { io, Socket } from "socket.io-client";
import type { TicketEvent } from "@/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

let socket: Socket | null = null;
let messageQueue: { event: string; data: unknown }[] = [];

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("[WS] Connected:", socket?.id);
      messageQueue.forEach(({ event, data }) => socket?.emit(event, data));
      messageQueue = [];
    });

    socket.on("disconnect", (reason) => {
      console.warn("[WS] Disconnected:", reason);
      if (reason === "io server disconnect") {
        socket?.connect();
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[WS] Connection error:", err.message);
    });
  }

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function onTicketEvent(
  callback: (event: TicketEvent) => void
): () => void {
  const s = getSocket();
  s.on("ticket-event", callback);
  return () => {
    s.off("ticket-event", callback);
  };
}

export function emitEvent(event: string, data: unknown) {
  if (socket?.connected) {
    socket.emit(event, data);
  } else {
    messageQueue.push({ event, data });
  }
}
