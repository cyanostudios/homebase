import { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    app.log.info('Health check hit');
    return { status: 'ok' };
  });
};

export default healthRoute;
