/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { apiRouter } from './src/backend/routes.js';
import { scheduler } from './src/backend/scheduler.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.use((_req, res, next) => {
  const scriptSource = isProduction ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'";
  const connectSource = isProduction ? "connect-src 'self'" : "connect-src 'self' ws:";
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; ${scriptSource}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; ${connectSource}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`
  );
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Mount API Router on /api
app.use('/api', apiRouter);

// Start Notice Monitor background scheduler
if (process.env.DISABLE_SCHEDULER !== 'true') {
  scheduler.start();
}

async function startServer() {
  if (!isProduction) {
    // Dynamic import to avoid bundling Vite in production
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    console.log('[NoticeBondhu Server] Vite middleware mounted for development.');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[NoticeBondhu Server] Serving production static files from dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 Notice Monitor (নোটিশবন্ধু) is running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  console.error('[NoticeBondhu Server] Fatal startup error:', err);
  process.exit(1);
});
