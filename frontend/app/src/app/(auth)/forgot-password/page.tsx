"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api, ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Ticket } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgotPassword = useMutation({
    mutationFn: (email: string) => api.forgotPassword(email),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Ticket className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Correo enviado</CardTitle>
            <CardDescription>
              Si el email esta registrado, recibiras un enlace de recuperacion. Revisa tu bandeja de entrada.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/login" className="text-sm text-primary hover:underline">
              Volver al inicio de sesion
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Ticket className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Recuperar contrasena</CardTitle>
          <CardDescription>
            Ingresa tu email y te enviaremos un enlace de recuperacion
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            forgotPassword.mutate(email);
          }}
        >
          <CardContent className="space-y-4">
            {forgotPassword.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {forgotPassword.error instanceof ApiRequestError
                  ? forgotPassword.error.message
                  : "Error al enviar correo"}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
              {forgotPassword.isPending ? "Enviando..." : "Enviar enlace"}
            </Button>
            <Link href="/login" className="text-sm text-muted-foreground hover:underline">
              Volver al inicio de sesion
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
