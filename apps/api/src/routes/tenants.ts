import { FastifyPluginAsync } from 'fastify';

const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tenants', async (request, reply) => {
    app.log.info('Tenants route placeholder');
    return { tenants: [] };
  });
};

export default tenantRoutes;
