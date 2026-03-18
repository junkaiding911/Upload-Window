const express    = require('express');
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ⚙️ Admin-Passwort
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'meinPasswort123';

// Cloudinary Konfiguration (Werte als Railway-Variablen setzen)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dc4gxm75u',
  api_key:    process.env.CLOUDINARY_API_KEY    || '872843359196177',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'ytBrNqM0AWCA4C3BkhT2Dc7jsJw',
});

// Multer: Dateien im Arbeitsspeicher puffern (bis 1 GB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Upload-Endpunkt (öffentlich)
app.post('/upload', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'Keine Dateien empfangen.' });

  const name = req.body.name || 'Unbekannt';
  const now  = new Date().toLocaleString('de-DE');

  try {
    const uploads = await Promise.all(req.files.map(file => {
      return new Promise((resolve, reject) => {
        const today    = new Date().toISOString().slice(0, 10);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._\-äöüÄÖÜ ]/g, '_');
        const publicId = `artem-uploads/${today}/${Date.now()}_${safeName}`;

        const stream = cloudinary.uploader.upload_stream(
          {
            public_id:     publicId,
            resource_type: 'raw',       // alle Dateitypen (PDF, DOCX, etc.)
            use_filename:  true,
            overwrite:     false,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve({ name: file.originalname, url: result.secure_url, public_id: result.public_id, size: file.size });
          }
        );
        stream.end(file.buffer);
      });
    }));

    console.log(`[${now}] Upload von: ${name} — ${uploads.length} Datei(en)`);
    uploads.forEach(f => console.log(`  → ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`));

    res.json({ ok: true, files: uploads.length });
  } catch (err) {
    console.error('Upload-Fehler:', err);
    res.status(500).json({ error: 'Upload fehlgeschlagen.' });
  }
});

// Admin-Login
app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(401).json({ error: 'Falsches Passwort' });
});

// Dateiliste für Admin (von Cloudinary)
app.get('/admin/files', async (req, res) => {
  const pw = req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const result = await cloudinary.api.resources({
      type:          'upload',
      resource_type: 'raw',
      prefix:        'artem-uploads/',
      max_results:   200,
    });

    const files = result.resources.map(r => {
      const parts       = r.public_id.split('/');
      const rawFilename = parts[parts.length - 1];
      const name        = rawFilename.replace(/^\d+_/, '');
      const date        = parts[1] || '';
      return {
        name,
        public_id: r.public_id,
        url:       r.secure_url,
        date,
        size:      r.bytes,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    res.json(files);
  } catch (err) {
    console.error('Cloudinary Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Dateien.' });
  }
});

app.listen(PORT, () => {
  console.log(`\nServer läuft auf http://localhost:${PORT}`);
  console.log(`Admin-Bereich: http://localhost:${PORT}/admin.html\n`);
});
