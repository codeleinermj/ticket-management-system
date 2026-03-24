"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { api, ApiRequestError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  AGENT: "Agente",
  USER: "Usuario",
};

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || "");
  const [editingName, setEditingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfile = useMutation({
    mutationFn: (data: { name: string }) => api.updateProfile(data),
    onSuccess: (res) => {
      if (user) setUser({ ...user, name: res.data.name });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setEditingName(false);
      toast.success("Nombre actualizado");
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Error al actualizar");
    },
  });

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.changePassword(data),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Contrasena actualizada. Debes iniciar sesion nuevamente.");
    },
    onError: (err) => {
      toast.error(err instanceof ApiRequestError ? err.message : "Error al cambiar contrasena");
    },
  });

  const resendVerification = useMutation({
    mutationFn: () => api.resendVerification(),
    onSuccess: () => toast.success("Correo de verificacion enviado"),
    onError: () => toast.error("Error al enviar correo"),
  });

  if (!user) return null;

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSaveName = () => {
    if (name.trim().length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }
    updateProfile.mutate({ name: name.trim() });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("La contrasena debe tener al menos 8 caracteres");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error("La contrasena debe tener al menos 1 mayuscula y 1 numero");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contrasenas no coinciden");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Mi Perfil</h2>
        <p className="text-muted-foreground">
          Administra tu informacion personal y seguridad
        </p>
      </div>

      {user.emailVerified === false && (
        <div className="flex items-center justify-between rounded-md border border-yellow-500/50 bg-yellow-50 p-4 dark:bg-yellow-950/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Tu email no esta verificado. Verifica tu email para usar todas las funciones.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resendVerification.mutate()}
            disabled={resendVerification.isPending}
          >
            {resendVerification.isPending ? "Enviando..." : "Reenviar correo"}
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informacion</CardTitle>
            <CardDescription>Tu informacion personal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <Badge variant="secondary" className="mt-1">
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Nombre</Label>
              {editingName ? (
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={updateProfile.isPending}
                  >
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingName(false);
                      setName(user.name);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm">{user.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingName(true)}
                  >
                    Editar
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <p className="text-sm">{user.email}</p>
            </div>

            <div className="space-y-2">
              <Label>Miembro desde</Label>
              <p className="text-sm">
                {new Date(user.createdAt).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
            <CardDescription>Cambia tu contrasena</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Contrasena actual</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
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
              <Button
                type="submit"
                disabled={changePassword.isPending}
                className="w-full"
              >
                {changePassword.isPending ? "Cambiando..." : "Cambiar contrasena"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
