import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = 3000;

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Middleware
app.use(cors());
app.use(express.json());

// Configure storage for images
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DB_FILE = path.join(process.cwd(), 'db.json');

// Ensure uploads directory exists
async function ensureDirs() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
}
ensureDirs();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    } catch (err) {
      cb(err as Error, UPLOADS_DIR);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage });

// Database logic
interface Photo {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  tags: string[];
}

async function getDB(): Promise<Photo[]> {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveDB(photos: Photo[]) {
  await fs.writeFile(DB_FILE, JSON.stringify(photos, null, 2));
}

// API Routes
app.get('/api/photos', async (req, res) => {
  const photos = await getDB();
  res.json(photos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

app.post('/api/photos', upload.array('photos', 100), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const photos = await getDB();
  const newPhotos: Photo[] = [];

  for (const file of files) {
    const newPhoto: Photo = {
      id: uuidv4(),
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    newPhotos.push(newPhoto);
    photos.push(newPhoto);
  }

  await saveDB(photos);
  res.status(201).json(newPhotos);
});

app.post('/api/photos/url', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let downloadUrl = url;
  let originalName = 'downloaded_image';
  
  // Google Drive ID extraction
  const gdriveRegex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([-\w]+)/;
  const match = url.match(gdriveRegex);
  
  if (match && match[1]) {
    const fileId = match[1];
    downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    originalName = `gdrive_${fileId}`;
  }

  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = contentType === 'image/png' ? '.png' : 
                contentType === 'image/webp' ? '.webp' : 
                contentType === 'image/gif' ? '.gif' : '.jpg';
                
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    
    await fs.writeFile(filePath, buffer);
    
    const newPhoto: Photo = {
      id: uuidv4(),
      url: `/uploads/${fileName}`,
      name: originalName + ext,
      size: buffer.length,
      type: contentType,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    
    const photos = await getDB();
    photos.push(newPhoto);
    await saveDB(photos);
    
    res.status(201).json([newPhoto]);
  } catch (error) {
    console.error('Error downloading from URL:', error);
    res.status(500).json({ error: 'Failed to download image from the provided URL' });
  }
});

app.delete('/api/photos/:id', async (req, res) => {
  const { id } = req.params;
  let photos = await getDB();
  const photoToDelete = photos.find(p => p.id === id);

  if (!photoToDelete) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  // Try to delete the file
  const fileName = photoToDelete.url.split('/').pop();
  if (fileName) {
    try {
      await fs.unlink(path.join(UPLOADS_DIR, fileName));
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  }

  photos = photos.filter(p => p.id !== id);
  await saveDB(photos);

  res.json({ message: 'Deleted successfully' });
});

app.post('/api/photos/:id/tag', async (req, res) => {
  const { id } = req.params;
  const photos = await getDB();
  const photo = photos.find(p => p.id === id);

  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    const filePath = path.join(UPLOADS_DIR, photo.url.split('/').pop()!);
    const fileData = await fs.readFile(filePath);
    
    const result = await geminiModel.generateContent([
      {
        inlineData: {
          data: fileData.toString('base64'),
          mimeType: photo.type
        }
      },
      "Generate 5 relevant short tags for this image. Output only the tags separated by commas. (e.g. landscape, nature, sunset)"
    ]);

    const tags = result.response.text().split(',').map(t => t.trim().toLowerCase());
    photo.tags = Array.from(new Set([...photo.tags, ...tags]));
    
    await saveDB(photos);
    res.json(photo);
  } catch (error) {
    console.error('AI Tagging error:', error);
    res.status(500).json({ error: 'Failed to generate tags' });
  }
});
app.use('/uploads', express.static(UPLOADS_DIR));

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
