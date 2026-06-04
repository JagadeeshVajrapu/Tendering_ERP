import morgan from 'morgan';
import { env } from './env';

const devFormat = ':method :url :status :res[content-length] - :response-time ms';
const prodFormat = ':remote-addr :method :url :status :res[content-length] - :response-time ms';

export const httpLogger = morgan(env.isProduction ? prodFormat : devFormat, {
  skip: (req) => req.url === '/health',
});
