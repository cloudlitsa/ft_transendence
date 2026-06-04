// One shared PrismaClient for the whole backend.
// Creating multiple PrismaClient instances opens multiple DB connection pools,
// which is wasteful and can exhaust Postgres. One instance, imported everywhere.

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
