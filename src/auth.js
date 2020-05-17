const request = require('request-promise');
const logger = require('./logger');

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

async function getAppToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    logger.log(
      'error',
      '\n***No Twitch Client ID and Client Secret provided. Cannot use advanced features like rich embeds***\n',
    );
    return null;
  }
  const options = {
    method: 'POST',
    uri: `https://id.twitch.tv/oauth2/token`,
    qs: {
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
    json: true,
  };
  return request(options)
    .then((response) => {
      return response.access_token;
    })
    .catch((e) => {
      logger.log(
        'error',
        `ERROR: POST twitch API @ https://id.twitch.tv/oauth2/token:`,
        e,
      );
    });
}

module.exports = {
  getAppToken,
};
