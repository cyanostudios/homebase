import { FastifyRequest, FastifyReply } from 'fastify';

export async function rbacMiddleware(request: FastifyRequest, reply: FastifyReply) {
  request.log.info('RBAC permission check middleware placeholder');
  // TODO: check permissions
}
