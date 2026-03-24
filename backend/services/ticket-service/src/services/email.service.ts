import * as net from "net";
import { config } from "../config";

class EmailService {
  private async sendSmtp(to: string, subject: string, html: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(config.SMTP_PORT, config.SMTP_HOST);
      const lines: string[] = [];

      const send = (cmd: string) => {
        socket.write(cmd + "\r\n");
      };

      let step = 0;
      socket.on("data", (data) => {
        const response = data.toString();
        lines.push(response);

        switch (step) {
          case 0: // greeting
            send(`EHLO localhost`);
            step++;
            break;
          case 1: // EHLO response
            send(`MAIL FROM:<${config.EMAIL_FROM}>`);
            step++;
            break;
          case 2: // MAIL FROM response
            send(`RCPT TO:<${to}>`);
            step++;
            break;
          case 3: // RCPT TO response
            send("DATA");
            step++;
            break;
          case 4: // DATA response
            send(
              `From: ${config.EMAIL_FROM}\r\n` +
              `To: ${to}\r\n` +
              `Subject: ${subject}\r\n` +
              `Content-Type: text/html; charset=utf-8\r\n` +
              `\r\n` +
              `${html}\r\n.`
            );
            step++;
            break;
          case 5: // end of data
            send("QUIT");
            step++;
            break;
          case 6:
            socket.end();
            resolve();
            break;
        }
      });

      socket.on("error", reject);
      socket.on("timeout", () => reject(new Error("SMTP timeout")));
      socket.setTimeout(10000);
    });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${token}`;
    const subject = "Restablece tu contrasena - Ticket Gestion";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hola ${name},</h2>
        <p>Recibimos una solicitud para restablecer tu contrasena.</p>
        <p>Haz click en el siguiente enlace (valido por 1 hora):</p>
        <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: white; text-decoration: none; border-radius: 6px;">Restablecer contrasena</a></p>
        <p>Si no solicitaste esto, ignora este correo.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">Ticket Gestion - Soporte</p>
      </div>
    `;
    await this.sendSmtp(to, subject, html);
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${token}`;
    const subject = "Verifica tu cuenta - Ticket Gestion";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hola ${name},</h2>
        <p>Gracias por registrarte. Verifica tu email haciendo click aqui:</p>
        <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: white; text-decoration: none; border-radius: 6px;">Verificar mi cuenta</a></p>
        <p>Este enlace expira en 24 horas.</p>
        <hr />
        <p style="color: #666; font-size: 12px;">Ticket Gestion - Soporte</p>
      </div>
    `;
    await this.sendSmtp(to, subject, html);
  }
}

export const emailService = new EmailService();
