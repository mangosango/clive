import Axios from 'axios';
import { setupCache } from 'axios-cache-interceptor';
const instance = Axios.create();
export default setupCache(instance);
