import { FastifyRequest, FastifyReply } from 'fastify';

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  request.log.info('Tenant resolution middleware placeholder');
  // TODO: resolve tenant from request
}
