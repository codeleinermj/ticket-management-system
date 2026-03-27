"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTickets } from "@/hooks/use-tickets";
import { TicketStatus } from "@/types";
import {
  Inbox,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

function StatCounter({ target }: { target: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = count.set(target);
    const animation = count.get();
    if (typeof animation === "number") {
      const timer = setTimeout(() => {
        count.set(target);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [target, count]);

  return <motion.span>{rounded}</motion.span>;
}

export function StatsCards() {
  const { data, isLoading } = useTickets();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const tickets = data?.data?.data || [];
  const total = data?.data?.meta?.total || 0;
  const open = tickets.filter((t) => t.status === TicketStatus.OPEN).length;
  const inProgress = tickets.filter(
    (t) => t.status === TicketStatus.IN_PROGRESS
  ).length;
  const resolved = tickets.filter(
    (t) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED
  ).length;
  const pendingReview = tickets.filter(
    (t) => t.status === TicketStatus.PENDING_MANUAL_REVIEW
  ).length;

  const stats = [
    {
      title: "Total Tickets",
      value: total,
      icon: Inbox,
      description: "En el sistema",
    },
    {
      title: "Abiertos",
      value: open,
      icon: Clock,
      description: "Pendientes de atencion",
    },
    {
      title: "En Progreso",
      value: inProgress + pendingReview,
      icon: AlertTriangle,
      description: "Siendo atendidos",
    },
    {
      title: "Resueltos",
      value: resolved,
      icon: CheckCircle,
      description: "Completados",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <StatCounter target={stat.value} />
              </div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
