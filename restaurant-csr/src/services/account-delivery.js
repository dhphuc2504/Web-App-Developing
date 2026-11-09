import nodemailer from "nodemailer";
import { allowedCaptchaHostnames } from "../lib/origins.js";
import { AppError } from "../lib/errors.js";
export function createAccountDelivery(
  config,
  {
    fetchImpl = fetch,
    transportFactory = nodemailer.createTransport,
    sendTimeoutMs = 20000,
  } = {},
) {
  const ready = () =>
    config.SMTP_HOST &&
    config.SMTP_USER &&
    config.SMTP_PASSWORD &&
    config.SMTP_FROM &&
    config.APP_ORIGIN;
  return {
    async send({ email, purpose, token }) {
      if (!ready())
        throw new AppError(
          503,
          "Email delivery is unavailable. Please try again later.",
        );
      const link = new URL(
        purpose === "verify" ? "/verify-email" : "/reset-password",
        config.APP_ORIGIN,
      );
      link.searchParams.set("token", token);
      const transport = transportFactory({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT || 587,
        secure: config.SMTP_SECURE === true,
        requireTLS: config.SMTP_SECURE !== true,
        auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      let deadline;
      try {
        await Promise.race([
          transport.sendMail({
            from: config.SMTP_FROM,
            to: email,
            subject:
              purpose === "login"
                ? "Your Santaishi-tei sign-in code"
                : purpose === "verify"
                  ? "Verify your Santaishi-tei email"
                  : "Reset your Santaishi-tei password",
            text:
              purpose === "login"
                ? `Your sign-in code is ${token}. It expires in 5 minutes. Never share this code. If you did not sign in, ignore this email.`
                : `${purpose === "verify" ? "Verify your email" : "Reset your password"} using this single-use link:
${link}

The link expires in ${purpose === "verify" ? "24 hours" : "30 minutes"}. If you did not request this, ignore this email.`,
          }),
          new Promise((_, reject) => {
            deadline = setTimeout(
              () => reject(new Error("Email delivery timed out")),
              sendTimeoutMs,
            );
          }),
        ]);
      } catch {
        throw new AppError(
          503,
          "Email delivery is unavailable. Please try again later.",
        );
      } finally {
        clearTimeout(deadline);
        transport.close();
      }
    },
    async captcha(token) {
      if (!config.RECAPTCHA_SECRET_KEY || !config.RECAPTCHA_SITE_KEY)
        throw new AppError(503, "Registration CAPTCHA is not configured yet.");
      if (typeof token !== "string" || !token || token.length > 10000)
        throw new AppError(422, "Complete the CAPTCHA and try again.");
      let result;
      try {
        const response = await fetchImpl(
          "https://www.google.com/recaptcha/api/siteverify",
          {
            method: "POST",
            body: new URLSearchParams({
              secret: config.RECAPTCHA_SECRET_KEY,
              response: token,
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok) throw new Error();
        result = await response.json();
      } catch {
        throw new AppError(
          503,
          "CAPTCHA verification is unavailable. Please try again.",
        );
      }
      if (
        !result.success ||
        !allowedCaptchaHostnames(config).has(result.hostname)
      )
        throw new AppError(
          422,
          "CAPTCHA expired or was invalid. Please complete it again.",
        );
    },
  };
}
