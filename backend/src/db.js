const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// WAL + busy timeout let multiple app replicas share one SQLite file.
async function tuneSqlite() {
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000');
}

module.exports = { prisma, tuneSqlite };
