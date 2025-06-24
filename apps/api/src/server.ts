import Fastify from 'fastify';

const app = Fastify();

app.get('/', async () => {
  return { status: 'ok' };
});

app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`server listening on ${address}`);
});
