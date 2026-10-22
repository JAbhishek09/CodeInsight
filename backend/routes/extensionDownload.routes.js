/**
 * GET /api/extension/download — the browser extension as a zip, already
 * pointed at the server it was downloaded from. Students get it from
 * Profile → Connections → Browser extension; no one has to send them a file.
 *
 * Public on purpose: the extension's code isn't secret, and a plain link
 * can't carry the sign-in token. It still needs that token to do anything.
 */

import express from 'express';
import { createZip } from '../utils/zip.js';
import { customize, readExtensionFiles } from '../../extension/scripts/customize.mjs';

const router = express.Router();
const FOLDER = 'codeinsight-extension';
const cache = new Map(); // origin → zip (the files only change on redeploy)

/** The address students reach this server at (https behind a proxy with TRUST_PROXY). */
const ownOrigin = (req) => `${req.protocol}://${req.get('host')}`;

router.get('/download', (req, res) => {
  const origin = ownOrigin(req);
  let zip = cache.get(origin);
  if (!zip) {
    let files;
    try {
      files = customize(readExtensionFiles(), { api: origin });
    } catch (e) {
      // e.g. plain http on a non-localhost host: the extension would be refused by browsers' https rules
      res.status(503);
      throw new Error(`The extension can't be built for ${origin}: ${e.message}`);
    }
    zip = createZip([...files].map(([rel, data]) => [`${FOLDER}/${rel}`, data]));
    cache.set(origin, zip);
  }
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${FOLDER}.zip"`,
    'Cache-Control': 'no-cache',
  });
  res.send(zip);
});

export default router;
