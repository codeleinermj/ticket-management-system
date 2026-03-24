import { Hono } from "hono";
import { attachmentRepository } from "../repositories/attachment.repository";
import { ticketRepository } from "../repositories/ticket.repository";
import { NotFoundError, ForbiddenError } from "@repo/shared";
import { config } from "../config";
import * as fs from "fs";
import * as path from "path";

export const attachmentRoutes = new Hono();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "sh", "js", "php", "py", "zip", "rar",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB per ticket
const MAX_FILES_PER_TICKET = 10;

// List attachments for a ticket
attachmentRoutes.get("/:ticketId/attachments", async (c) => {
  const ticketId = c.req.param("ticketId");
  const attachments = await attachmentRepository.findByTicketId(ticketId);
  return c.json({ success: true, data: attachments });
});

// Upload attachment
attachmentRoutes.post("/:ticketId/attachments", async (c) => {
  const ticketId = c.req.param("ticketId");
  const userId = c.req.header("x-user-id")!;
  const userRole = c.req.header("x-user-role")!;

  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new NotFoundError("Ticket not found");

  if (userRole === "USER" && ticket.createdById !== userId) {
    throw new ForbiddenError("You can only add attachments to your own tickets");
  }

  // Check file count limit
  const count = await attachmentRepository.countByTicketId(ticketId);
  if (count >= MAX_FILES_PER_TICKET) {
    return c.json({ success: false, error: `Maximo ${MAX_FILES_PER_TICKET} archivos por ticket` }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return c.json({ success: false, error: "No file uploaded" }, 400);
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ success: false, error: "Archivo excede 10MB" }, 400);
  }

  // Check total size
  const totalSize = await attachmentRepository.totalSizeByTicketId(ticketId);
  if (totalSize + file.size > MAX_TOTAL_SIZE) {
    return c.json({ success: false, error: "Se excedio el limite de 50MB por ticket" }, 400);
  }

  // Check extension
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return c.json({ success: false, error: "Tipo de archivo no permitido" }, 400);
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return c.json({ success: false, error: "Tipo de archivo no permitido" }, 400);
  }

  // Save file
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileId = crypto.randomUUID();
  const storagePath = `${year}/${month}/${fileId}.${ext}`;
  const fullPath = path.join(config.STORAGE_PATH, storagePath);

  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(fullPath, buffer);

  const attachment = await attachmentRepository.create({
    filename: file.name,
    storagePath,
    mimeType: file.type,
    size: file.size,
    ticketId,
    uploadedById: userId,
  });

  return c.json({ success: true, data: attachment }, 201);
});

// Download attachment
attachmentRoutes.get("/attachments/:id/download", async (c) => {
  const id = c.req.param("id");
  const attachment = await attachmentRepository.findById(id);

  if (!attachment) throw new NotFoundError("Attachment not found");

  const fullPath = path.join(config.STORAGE_PATH, attachment.storagePath);
  if (!fs.existsSync(fullPath)) {
    throw new NotFoundError("File not found on disk");
  }

  const fileBuffer = fs.readFileSync(fullPath);
  c.header("Content-Type", attachment.mimeType);
  c.header("Content-Disposition", `attachment; filename="${attachment.filename}"`);
  return c.body(fileBuffer);
});

// Delete attachment
attachmentRoutes.delete("/attachments/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.header("x-user-id")!;
  const userRole = c.req.header("x-user-role")!;

  const attachment = await attachmentRepository.findById(id);
  if (!attachment) throw new NotFoundError("Attachment not found");

  if (attachment.uploadedById !== userId && userRole !== "AGENT" && userRole !== "ADMIN") {
    throw new ForbiddenError("Not authorized to delete this attachment");
  }

  // Delete file from disk
  const fullPath = path.join(config.STORAGE_PATH, attachment.storagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  await attachmentRepository.delete(id);
  return c.json({ success: true, data: { message: "Attachment deleted" } });
});
