"use client";

import { useState } from "react";
import Link from "next/link";
import { useLogin } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingTickets } from "@/components/auth/floating-tickets";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ApiRequestError } from "@/lib/api";
import { motion } from "framer-motion";
import { Ticket, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="relative min-h-screen auth-bg auth-bg-animated overflow-hidden flex items-center justify-center px-4">
      {/* Floating background elements */}
      <FloatingTickets />

      {/* Theme toggle */}
      <motion.div
        className="absolute top-6 right-6 z-50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <ThemeToggle />
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="glass rounded-2xl p-8 shadow-2xl"
        >
          {/* Logo and branding */}
          <motion.div
            className="text-center mb-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Ticket className="h-8 w-8 text-white" />
            </motion.div>

            <motion.div variants={itemVariants}>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
                TicketAI
              </h1>
              <p className="text-sm text-slate-500 dark:text-white/40">
                Sistema inteligente de gestion de tickets
              </p>
            </motion.div>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {login.error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/20 dark:border-red-400/30 p-3 text-sm text-red-600 dark:text-red-200"
              >
                {login.error instanceof ApiRequestError
                  ? login.error.message
                  : "Error al iniciar sesion"}
              </motion.div>
            )}

            {/* Email field */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 dark:text-white/60">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-white/80 dark:bg-white/5 border-indigo-200/50 dark:border-white/10 placeholder-slate-400 dark:placeholder-white/30 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-indigo-400/30 dark:focus:border-purple-400 dark:focus:ring-purple-400/30"
              />
            </motion.div>

            {/* Password field */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 dark:text-white/60">
                  Contrasena
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-purple-300/70 dark:hover:text-purple-200 transition-colors"
                >
                  Olvide mi contrasena?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-white/80 dark:bg-white/5 border-indigo-200/50 dark:border-white/10 placeholder-slate-400 dark:placeholder-white/30 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-indigo-400/30 dark:focus:border-purple-400 dark:focus:ring-purple-400/30"
              />
            </motion.div>

            {/* Submit button */}
            <motion.div variants={itemVariants}>
              <motion.button
                type="submit"
                disabled={login.isPending}
                className="w-full font-semibold py-2.5 rounded-xl transition-all duration-300 disabled:opacity-50
                  bg-gradient-to-r from-indigo-500 to-purple-600
                  text-white shadow-lg shadow-indigo-500/25 dark:shadow-purple-600/20
                  hover:shadow-xl hover:shadow-indigo-500/35 dark:hover:shadow-purple-600/30"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {login.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </motion.span>
                    Ingresando...
                  </span>
                ) : (
                  "Ingresar"
                )}
              </motion.button>
            </motion.div>
          </form>

          {/* Register link */}
          <motion.p
            variants={itemVariants}
            className="text-center text-sm text-slate-500 dark:text-white/35 mt-6"
          >
            No tienes cuenta?{" "}
            <Link
              href="/register"
              className="text-indigo-600 hover:text-indigo-800 dark:text-purple-300 dark:hover:text-purple-200 font-semibold transition-colors"
            >
              Registrate aqui
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
