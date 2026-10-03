const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const { prisma, tuneSqlite } = require('./db');

async function main() {
  await tuneSqlite();
  const server = app.listen(config.port, () => logger.info('server started', { port: config.port }));

  const shutdown = (signal) => {
    logger.info('shutting down', { signal });
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('failed to start', { error: err.message });
  process.exit(1);
});
