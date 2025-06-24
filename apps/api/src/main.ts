import Fastify from 'fastify';
import healthRoute from './routes/health';
import authRoute from './routes/auth';
import tenantsRoute from './routes/tenants';
import { connectDB } from './db';

const app = Fastify();

app.register(healthRoute);
app.register(authRoute);
app.register(tenantsRoute);

const start = async () => {
  try {
    await connectDB();
    await app.listen({ port: 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
