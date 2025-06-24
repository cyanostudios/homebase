import { FastifyRequest, FastifyReply } from 'fastify';

export async function auditMiddleware(request: FastifyRequest, reply: FastifyReply) {
  request.log.info('Audit logging middleware placeholder');
  // TODO: record audit log
}
