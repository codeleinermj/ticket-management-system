"use client";

import Link from "next/link";
import { useTickets } from "@/hooks/use-tickets";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

interface RecentTicketsProps {
  basePath?: string;
}

export function RecentTickets({ basePath = "/dashboard" }: RecentTicketsProps) {
  const { data, isLoading } = useTickets();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tickets Recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const tickets = data?.data?.data?.slice(0, 5) || [];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="popLayout">
            {tickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                variants={itemVariants}
                exit={{ opacity: 0, x: -20 }}
              >
                <Link
                  href={`${basePath}/tickets/${ticket.id}`}
                  className="flex items-center justify-between rounded-md p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {ticket.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.createdBy?.name} &middot;{" "}
                      {new Date(ticket.createdAt).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
          {tickets.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No hay tickets recientes
            </p>
          )}
        </motion.div>
      </CardContent>
    </Card>
  );
}
