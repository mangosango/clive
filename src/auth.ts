import axios from 'axios';
import logger from './logger.js';

export async function getAppToken(
  twitchClientId: string,
  twitchClientSecret: string,
): Promise<string | null> {
  const options = {
    method: 'post',
    url: `https://id.twitch.tv/oauth2/token`,
    params: {
      client_id: twitchClientId,
      client_secret: twitchClientSecret,
      grant_type: 'client_credentials',
    },
  };
  try {
    const response = await axios.request(options);
    const accessToken: string = response.data.access_token;
    return accessToken;
  } catch (err) {
    logger.log(
      'error',
      `ERROR: POST twitch API @ https://id.twitch.tv/oauth2/token:`,
      err,
    );
  }
  return null;
}
