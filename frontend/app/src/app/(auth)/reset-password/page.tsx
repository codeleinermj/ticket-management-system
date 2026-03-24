"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Ticket } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState("");

  const resetPassword = useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      api.resetPassword(token, newPassword),
    onSuccess: () => setSuccess(true),
  });

  if (!token) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Enlace invalido</CardTitle>
          <CardDescription>
            El enlace de recuperacion es invalido o ha expirado.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Solicitar nuevo enlace
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-green-600">
            <Ticket className="h-6 w-6 text-white" />
          </div>
          <CardTitle>Contrasena actualizada</CardTitle>
          <CardDescription>
            Tu contrasena ha sido cambiada exitosamente.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Iniciar sesion
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (newPassword.length < 8) {
      setValidationError("La contrasena debe tener al menos 8 caracteres");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setValidationError("Debe tener al menos 1 mayuscula y 1 numero");
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Las contrasenas no coinciden");
      return;
    }
    resetPassword.mutate({ token, newPassword });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
          <Ticket className="h-6 w-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">Nueva contrasena</CardTitle>
        <CardDescription>Ingresa tu nueva contrasena</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {(validationError || resetPassword.error) && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {validationError ||
                (resetPassword.error instanceof ApiRequestError
                  ? resetPassword.error.message
                  : "Error al cambiar contrasena")}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contrasena</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 chars, 1 mayuscula, 1 numero"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Repetir contrasena</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
            {resetPassword.isPending ? "Cambiando..." : "Cambiar contrasena"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Suspense fallback={<div>Cargando...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
