import { env } from "./config/env.js";
import { createDatabase } from "./config/database.js";

import { createApp } from "./app.js";
import { listenForStartup, startupFailureMessage } from "./lib/startup.js";
import { installShutdown } from "./lib/shutdown.js";
let db;
try {
  console.log("Checking restaurant database connectivity...");
  db = createDatabase(env.DATABASE_URL);
  await db.$connect();
  await db.staffUser.count();
  const app = createApp({ db, config: env });
  const server = await listenForStartup(
    app,
    env.PORT,
    env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  );
  console.log(`Restaurant API listening on port ${env.PORT}.`);
  const cleanup = setInterval(
    () =>
      Promise.all([
        db.loginChallenge.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        }),
        db.failedAttempt.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        }),
      ]).catch(() => {}),
    3600000,
  );
  cleanup.unref();
  installShutdown({ server, db, cleanup });
} catch (error) {
  console.error(startupFailureMessage(error, env.PORT));
  if (db) await db.$disconnect().catch(() => {});
  process.exit(1);
}
