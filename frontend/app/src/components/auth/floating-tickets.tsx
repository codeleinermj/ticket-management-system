"use client";

import { motion } from "framer-motion";
import { Ticket, Bug, Zap, MessageSquare, Shield, Headphones, AlertCircle } from "lucide-react";
import { useMemo } from "react";

const icons = [Ticket, Bug, Zap, MessageSquare, Shield, Headphones, AlertCircle];

// 5 columnas x 3 filas = 15 celdas, cada ticket en su propia zona
const COLS = 5;
const ROWS = 3;

// PRNG determinista: mismo seed = mismo resultado en server y client
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function FloatingTickets() {
  const tickets = useMemo(() => {
    return Array.from({ length: COLS * ROWS }).map((_, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const cellW = 100 / COLS;
      const cellH = 100 / ROWS;
      const centerX = col * cellW + cellW / 2;
      const centerY = row * cellH + cellH / 2;

      const r2 = (v: number) => Math.round(v * 100) / 100;

      const jitterX = (seededRandom(i * 4 + 0) - 0.5) * cellW * 0.4;
      const jitterY = (seededRandom(i * 4 + 1) - 0.5) * cellH * 0.4;
      const range = r2(22 + seededRandom(i * 4 + 2) * 18);

      return {
        id: i,
        startX: r2(centerX + jitterX),
        startY: r2(centerY + jitterY),
        duration: r2(9 + seededRandom(i * 4 + 3) * 10),
        delay: i * 0.3,
        scale: r2(0.5 + seededRandom(i * 4 + 4) * 0.45),
        peakOpacity: r2(0.45 + seededRandom(i * 4 + 5) * 0.4),
        icon: i % icons.length,
        direction: (i % 2 === 0 ? 1 : -1) as 1 | -1,
        range,
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {tickets.map((ticket) => {
        const TicketIcon = icons[ticket.icon];
        const r = ticket.range;
        const d = ticket.direction;

        return (
          <motion.div
            key={ticket.id}
            className="absolute"
            style={{
              left: `${ticket.startX}%`,
              top: `${ticket.startY}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: ticket.peakOpacity,
              scale: ticket.scale,
              y: [0, -r * 0.8, r * 0.4, -r, 0],
              x: [0, r * d, -r * 0.5 * d, r * 0.7 * d, 0],
            }}
            transition={{
              opacity: { duration: 1.5, delay: ticket.delay },
              scale: { duration: 1.5, delay: ticket.delay },
              y: {
                duration: ticket.duration,
                delay: ticket.delay,
                repeat: Infinity,
                ease: "easeInOut",
              },
              x: {
                duration: ticket.duration * 1.15,
                delay: ticket.delay,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          >
            <div
              className="rounded-xl p-3 flex items-start gap-2.5 w-44 border backdrop-blur-md
                bg-white/35 border-indigo-300/45 dark:bg-white/12 dark:border-white/20
                shadow-lg shadow-indigo-500/15 dark:shadow-purple-500/20"
            >
              <TicketIcon className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-purple-300" />
              <div className="space-y-1.5 w-full">
                <div className="h-2 rounded-full w-3/4 bg-indigo-500/35 dark:bg-white/30"></div>
                <div className="h-2 rounded-full w-1/2 bg-violet-500/28 dark:bg-white/22"></div>
                <div className="h-2 rounded-full w-2/3 bg-purple-500/22 dark:bg-white/18"></div>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Ambient orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-indigo-400/15 dark:bg-indigo-400/5 blur-3xl"
        animate={{ scale: [1, 1.4, 0.9, 1.3, 1], x: [0, 60, -40, 30, 0], y: [0, -40, 20, -60, 0], opacity: [0.3, 0.6, 0.25, 0.55, 0.3] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-400/15 dark:bg-purple-400/5 blur-3xl"
        animate={{ scale: [1.2, 0.8, 1.3, 0.9, 1.2], x: [0, -70, 40, -50, 0], y: [0, 50, -30, 60, 0], opacity: [0.4, 0.2, 0.5, 0.15, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full bg-violet-400/12 dark:bg-violet-400/5 blur-3xl"
        animate={{ scale: [0.8, 1.3, 0.7, 1.2, 0.8], x: [0, 80, -60, 50, 0], y: [0, -50, 40, -30, 0], opacity: [0.25, 0.5, 0.2, 0.45, 0.25] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-1/3 left-1/3 w-64 h-64 rounded-full bg-indigo-300/10 dark:bg-indigo-500/5 blur-3xl"
        animate={{ scale: [1, 1.2, 0.85, 1.15, 1], x: [0, -50, 70, -30, 0], y: [0, 40, -50, 30, 0], opacity: [0.2, 0.45, 0.15, 0.4, 0.2] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
    </div>
  );
}
