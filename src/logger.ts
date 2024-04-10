import { createLogger, format, transports } from 'winston';

//Initialize logger
const logger = createLogger({
  level: process?.env?.LOG_LEVEL || 'error',
  format: format.combine(format.timestamp(), format.prettyPrint()),
  transports: [
    // - Write to all logs with level `info` and below to `clive.log`
    new transports.File({
      filename: process?.env?.LOG_FILE || 'clive.log',
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
