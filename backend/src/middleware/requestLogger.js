import morgan from 'morgan';
import env from '../config/env.js';

morgan.token('user-id', (req) => req.user?.id || '-');

const format = env.isProd
  ? ':remote-addr :method :url :status :res[content-length] - :response-time ms uid=:user-id'
  : ':method :url :status :response-time ms';

export const requestLogger = morgan(format);
