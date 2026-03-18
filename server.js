const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ⚙️ HIER DEIN ADMIN-PASSWORT ÄNDERN
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'meinPasswort123';

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(UPLOAD_DIR, today);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName  = file.originalname.replace(/[^a-zA-Z0-9._\-äöüÄÖÜ ]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Upload-Endpunkt (öffentlich)
app.post('/upload', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'Keine Dateien empfangen.' });
  const name = req.body.name || 'Unbekannt';
  const now  = new Date().toLocaleString('de-DE');
  console.log(`[${now}] Upload von: ${name} — ${req.files.length} Datei(en)`);
  res.json({ ok: true, files: req.files.length });
});

// Admin-Login prüfen
app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(401).json({ error: 'Falsches Passwort' });
});

// Dateiliste für Admin
app.get('/admin/files', (req, res) => {
  const pw = req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Nicht autorisiert' });

  const result = [];
  if (!fs.existsSync(UPLOAD_DIR)) return res.json([]);

  const dates = fs.readdirSync(UPLOAD_DIR).sort().reverse();
  for (const date of dates) {
    const dir = path.join(UPLOAD_DIR, date);
    if (!fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir).map(fname => {
      const stat = fs.statSync(path.join(dir, fname));
      const originalName = fname.replace(/^\d+_/, '');
      return { name: originalName, filename: fname, date, size: stat.size, mtime: stat.mtime };
    });
    result.push(...files);
  }
  res.json(result);
});

// Datei herunterladen
app.get('/admin/download/:date/:filename', (req, res) => {
  const pw = req.headers['x-admin-password'] || req.query.pw;
  if (pw !== ADMIN_PASSWORD) return res.status(401).send('Nicht autorisiert');

  const filePath = path.join(UPLOAD_DIR, req.params.date, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Datei nicht gefunden');

  const originalName = req.params.filename.replace(/^\d+_/, '');
  res.download(filePath, originalName);
});

app.listen(PORT, () => {
  console.log(`\nServer läuft auf http://localhost:${PORT}`);
  console.log(`Admin-Bereich: http://localhost:${PORT}/admin.html\n`);
});
