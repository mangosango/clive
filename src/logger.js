const _ = require('lodash');
const { createLogger, format, transports } = require('winston');
let logger;

if (!logger) {
  //Initialize logger
  logger = createLogger({
    level: _.get(process, 'env.LOG_LEVEL') || 'error',
    format: format.combine(format.timestamp(), format.prettyPrint()),
    transports: [
      // - Write to all logs with level `info` and below to `clive.log`
      new transports.File({
        filename: _.get(process, 'env.LOG_FILE') || 'clive.log',
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
}

module.exports = logger;
