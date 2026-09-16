import { token } from './config.js';

export function log(message) {
  const text = String(message);
  console.log(token ? text.replaceAll(token, '[TOKEN NASCOSTO]') : text);
}
