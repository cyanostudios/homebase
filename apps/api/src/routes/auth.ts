import { FastifyPluginAsync } from 'fastify';

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/login', async (request, reply) => {
    app.log.info('Auth login placeholder');
    return { message: 'login placeholder' };
  });
};

export default authRoutes;
