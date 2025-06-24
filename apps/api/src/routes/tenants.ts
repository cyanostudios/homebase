import { FastifyInstance } from 'fastify';

export default async function tenantsRoute(app: FastifyInstance) {
  app.get('/tenants', async () => {
    // TODO: implement tenant service
    return [];
  });
}
