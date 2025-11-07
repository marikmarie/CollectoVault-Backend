// src/api/_utils.ts
import { IncomingMessage } from 'http';

export function readJSON(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', chunk => buf += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(buf || '{}')); }
      catch (err) { reject(err); }
    });
  });
}
