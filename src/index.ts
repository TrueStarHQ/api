import 'dotenv/config';
import { getConfig } from './config/config.js';
import { createApp } from './app.js';

const startServer = async () => {
  try {
    const config = getConfig();

    // Import logger after config validation succeeds
    const { logger } = await import('./utils/logger.js');

    const fastify = await createApp();

    logger.info('Config validation passed');
    logger.info(`Configuration: PORT=${config.PORT}, HOST=${config.HOST}`);

    const port = config.PORT;
    const host = config.HOST;

    await fastify.listen({ port, host });
    logger.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
