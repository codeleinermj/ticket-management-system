import { Hono } from "hono";
import { authGuard, roleGuard } from "../middleware/auth";
import { config } from "../config";

export const attachmentRoutes = new Hono();

attachmentRoutes.use("*", authGuard());

// Download attachment
attachmentRoutes.get("/:id/download", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/attachments/${id}/download`, {
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  if (!res.ok) {
    return c.json(await res.json(), res.status as 404);
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const contentDisp = res.headers.get("content-disposition") || "";
  c.header("Content-Type", contentType);
  if (contentDisp) c.header("Content-Disposition", contentDisp);
  return c.body(await res.arrayBuffer());
});

// Delete attachment
attachmentRoutes.delete("/:id", roleGuard("AGENT", "ADMIN"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/attachments/${id}`, {
    method: "DELETE",
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });
  return c.json(await res.json(), res.status as 200);
});
