import { buildApp } from './app';
import { env } from './config/env';

const start = async () => {
  const app = buildApp();
  
  try {
    await app.listen({ port: parseInt(env.PORT, 10), host: env.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const gracefulShutdown = async (signal: string) => {
    app.log.info(`Received signal to terminate: ${signal}`);
    try {
      await app.close();
      app.log.info('Server closed gracefully');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
};

start();
