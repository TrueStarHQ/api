import 'dotenv/config';
import { getConfig } from './config/config.js';
import { createApp } from './app.js';

const startServer = async () => {
  try {
    const config = getConfig();
    const { logger } = await import('./utils/logger.js');

    const port = config.PORT;
    const host = config.HOST;

    logger.info('Config validation passed');
    logger.info(`Configuration: HOST=${host}, PORT=${port}`);

    const fastify = await createApp();
    await fastify.listen({ port, host });

    logger.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
