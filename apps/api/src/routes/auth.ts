import { FastifyInstance } from 'fastify';

export default async function authRoute(app: FastifyInstance) {
  app.post('/login', async () => {
    // TODO: integrate real authentication
    return { token: 'placeholder' };
  });
}
