const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/textures', async (_req, res) => {
  try {
    const baseDir = process.env.TEXTURES_DIR || path.resolve(__dirname, '../../../public/textures');
    const files = fs.existsSync(baseDir) ? fs.readdirSync(baseDir) : [];
    const items = files
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map((f) => ({
        id: f,
        label: f.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        src: `/textures/${f}`,
      }));
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;


