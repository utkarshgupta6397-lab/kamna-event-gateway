import { buildApp } from './app';
import { env } from './config/env';

const start = async () => {
  const app = buildApp();
  
  try {
    await app.listen({ port: parseInt(env.PORT, 10), host: env.HOST });
    app.log.info({
      msg: 'Server started',
      env: env.NODE_ENV,
      port: env.PORT,
      metaSignatureVerification: !!env.META_APP_SECRET
    });

    const gracefulShutdown = async (signal: string) => {
      app.log.info({ signal }, 'Received termination signal, starting graceful shutdown...');
      try {
        await app.close();
        app.log.info('Server gracefully closed');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
