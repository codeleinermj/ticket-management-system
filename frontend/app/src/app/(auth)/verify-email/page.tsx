"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  Card, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState(
    token ? "" : "Token de verificacion no proporcionado"
  );

  useEffect(() => {
    if (!token) return;

    api.verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Tu email ha sido verificado exitosamente");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Token invalido o expirado");
      });
  }, [token]);

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
          {status === "loading" && <Loader2 className="h-6 w-6 text-primary-foreground animate-spin" />}
          {status === "success" && <CheckCircle className="h-6 w-6 text-green-600" />}
          {status === "error" && <XCircle className="h-6 w-6 text-destructive" />}
        </div>
        <CardTitle className="text-2xl">
          {status === "loading" && "Verificando..."}
          {status === "success" && "Email verificado"}
          {status === "error" && "Error de verificacion"}
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Ir a inicio de sesion
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Suspense fallback={<div>Cargando...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
