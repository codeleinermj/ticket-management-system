"use client";

import { useState } from "react";
import { useUsers, useUpdateUserRole, useToggleUserActive } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth";
import { UserRole } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  AGENT: "Agente",
  USER: "Usuario",
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  AGENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  USER: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  const { data, isLoading } = useUsers({ page, search: search || undefined, role: roleFilter || undefined });
  const updateRole = useUpdateUserRole();
  const toggleActive = useToggleUserActive();

  // Redirect non-admins
  if (currentUser && currentUser.role !== UserRole.ADMIN) {
    router.push("/dashboard");
    return null;
  }

  const users = data?.data?.data || [];
  const meta = data?.data?.meta;

  const handleRoleChange = (userId: string, role: string) => {
    if (userId === currentUser?.id) {
      toast.error("No puedes cambiar tu propio rol");
      return;
    }
    updateRole.mutate(
      { userId, role },
      {
        onSuccess: () => toast.success("Rol actualizado"),
        onError: () => toast.error("Error al actualizar rol"),
      }
    );
  };

  const handleToggleActive = (userId: string, isActive: boolean) => {
    if (userId === currentUser?.id) {
      toast.error("No puedes desactivar tu propia cuenta");
      return;
    }
    toggleActive.mutate(
      { userId, isActive },
      {
        onSuccess: () => toast.success(isActive ? "Usuario activado" : "Usuario desactivado"),
        onError: () => toast.error("Error al actualizar estado"),
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Administrar Usuarios</CardTitle>
          <CardDescription>
            Gestiona roles y estado de los usuarios del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === "ALL" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todos los roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los roles</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="AGENT">Agente</SelectItem>
                <SelectItem value="USER">Usuario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Registrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No se encontraron usuarios
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            <Select
                              value={u.role}
                              onValueChange={(role) => handleRoleChange(u.id, role)}
                              disabled={u.id === currentUser?.id}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">Administrador</SelectItem>
                                <SelectItem value="AGENT">Agente</SelectItem>
                                <SelectItem value="USER">Usuario</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant={u.isActive ? "outline" : "destructive"}
                              size="sm"
                              onClick={() => handleToggleActive(u.id, !u.isActive)}
                              disabled={u.id === currentUser?.id}
                            >
                              {u.isActive ? "Activo" : "Inactivo"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(u.createdAt).toLocaleDateString("es-ES")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {meta.total} usuarios en total
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {page} / {meta.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= meta.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
