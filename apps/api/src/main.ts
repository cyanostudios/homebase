import Fastify from 'fastify';
import healthRoute from './routes/health';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import { authMiddleware } from './middlewares/auth';
import { tenantMiddleware } from './middlewares/tenant';
import { rbacMiddleware } from './middlewares/rbac';
import { auditMiddleware } from './middlewares/audit';
import { connectDB } from './db';

async function buildServer() {
  const app = Fastify({ logger: true });

  await connectDB();

  app.addHook('onRequest', auditMiddleware);
  app.addHook('onRequest', authMiddleware);
  app.addHook('preHandler', tenantMiddleware);
  app.addHook('preHandler', rbacMiddleware);

  app.register(healthRoute);
  app.register(authRoutes);
  app.register(tenantRoutes);

  return app;
}

async function main() {
  const app = await buildServer();
  const port = Number(process.env.PORT) || 3000;
  try {
    const address = await app.listen({ port });
    app.log.info(`server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
