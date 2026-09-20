const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const seoService = require('../services/seoService');
const { buildPageCsp } = require('../middleware/securityHeaders');

// Production-da build olunmuş React tətbiqini (frontend/dist) təqdim edir və hər səhifənin <head>-inə
// restoran/məhsula xas OG/Twitter/JSON-LD teqlərini yeridir (WhatsApp, Instagram, Google robotları üçün).
// Dev rejimində dist yoxdur — bu router heç nə etmir, frontend-i Vite verir.
const DIST_DIR = process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', '..', 'frontend', 'dist');

const baseUrlOf = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

function createSpaRouter(distDir = DIST_DIR) {
  const router = express.Router();
  const indexFile = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexFile)) return router;

  router.get('/sitemap.xml', asyncHandler(async (req, res) => {
    res.type('application/xml').send(await seoService.sitemap(baseUrlOf(req)));
  }));
  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(seoService.robots(baseUrlOf(req)));
  });

  // Hashed asset-lər (Vite) uzun müddət keşlənir; index.html və sw.js həmişə təzə yoxlanır
  router.use(express.static(distDir, {
    index: false,
    setHeaders: (res, file) => {
      if (path.relative(distDir, file).split(path.sep)[0] === 'assets') res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  router.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, asyncHandler(async (req, res) => {
    const html = await fsp.readFile(indexFile, 'utf8');
    let out = html;
    try {
      out = seoService.injectMeta(html, await seoService.metaForPath(req.path, baseUrlOf(req)));
    } catch (err) {
      console.warn('SEO meta yeridilə bilmədi, statik index.html verilir:', err.message);
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Security-Policy', buildPageCsp(out, process.env, baseUrlOf(req)));
    res.type('html').send(out);
  }));

  return router;
}

module.exports = createSpaRouter;
module.exports.createSpaRouter = createSpaRouter;
