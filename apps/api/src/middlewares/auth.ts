import { FastifyRequest, FastifyReply } from 'fastify';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  request.log.info('JWT auth middleware placeholder');
  // TODO: validate JWT token
}
