import 'dotenv/config';

import { createApp } from './app.js';
import { getConfig } from './config/config.js';
import { log } from './utils/logger.js';

const startServer = async () => {
  try {
    const config = getConfig();

    const port = config.PORT;
    const host = config.HOST;

    log.info('Config validation passed');
    log.info(`Configuration: HOST=${host}, PORT=${port}`);

    const fastify = await createApp();
    await fastify.listen({ port, host });

    log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
