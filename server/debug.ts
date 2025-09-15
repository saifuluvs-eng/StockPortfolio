import { appendFileSync } from 'fs';

export function debugLog(message: string) {
  appendFileSync('debug.log', `${new Date().toISOString()} - ${message}\n`);
}
