import axios from 'axios';
import logger from './logger.js';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

export async function getAppToken(): Promise<string | void> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    logger.log(
      'error',
      '\n***No Twitch Client ID and Client Secret provided. Cannot use advanced features like rich embeds***\n',
    );
    return;
  }
  const options = {
    method: 'post',
    url: `https://id.twitch.tv/oauth2/token`,
    params: {
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  };
  return axios
    .request(options)
    .then((response) => {
      const accessToken: string = response.data.access_token;
      return accessToken;
    })
    .catch((err) => {
      logger.log(
        'error',
        `ERROR: POST twitch API @ https://id.twitch.tv/oauth2/token:`,
        err,
      );
    });
}
