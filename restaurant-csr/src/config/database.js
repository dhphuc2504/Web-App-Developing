import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export function createDatabase(connectionString) {
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString, max: 5, connectionTimeoutMillis: 10000 },
      { schema: "restaurant" },
    ),
    errorFormat: "minimal",
  });
}
