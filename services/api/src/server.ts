import { app } from './index';

const port = Number(process.env.PORT ?? '3000');
const host = process.env.HOST ?? '0.0.0.0';

app.listen(port, host, () => {
  console.log(
    `PetPaw API http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`,
  );
});
