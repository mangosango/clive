import { createLogger, format, transports } from 'winston';
import data from '../config/config.json' with { type: 'json' };

//Initialize logger
const logger = createLogger({
  level: (data as any)?.logLevel || 'error',
  format: format.combine(format.timestamp(), format.prettyPrint()),
  transports: [
    // - Write to all logs with level `info` and below to `clive.log`
    new transports.File({
      filename: (data as any)?.logFile || 'clive.log',
    }),
  ],
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.simple(),
    }),
  );
}

export default logger;
