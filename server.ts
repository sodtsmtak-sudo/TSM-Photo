import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Configure storage for images
const upload = multer({ storage: multer.memoryStorage() });

interface Photo {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  tags: string[];
}

// API Routes
app.get('/api/photos', async (req, res) => {
  if (!supabaseUrl) return res.json([]);
  const { data, error } = await supabase.from('photos').select('*').order('createdAt', { ascending: false });
  if (error) {
    console.error('Error fetching photos:', error);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }
  res.json(data || []);
});

app.post('/api/photos', upload.array('photos', 100), async (req, res) => {
  if (!supabaseUrl) return res.status(500).json({ error: 'Supabase URL not configured' });
  
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const newPhotos: Photo[] = [];

  for (const file of files) {
    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });
      
    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      continue; // Skip this file if upload fails
    }

    const { data: publicUrlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    const newPhoto: Photo = {
      id: uuidv4(),
      url: publicUrlData.publicUrl,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    newPhotos.push(newPhoto);
  }

  // Insert to Supabase DB
  if (newPhotos.length > 0) {
    const { error: dbError } = await supabase.from('photos').insert(newPhotos);
    if (dbError) {
      console.error('Error inserting photos to DB:', dbError);
      return res.status(500).json({ error: 'Failed to save photo metadata' });
    }
  }

  res.status(201).json(newPhotos);
});

app.post('/api/photos/url', async (req, res) => {
  if (!supabaseUrl) return res.status(500).json({ error: 'Supabase URL not configured' });
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
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, buffer, {
        contentType: contentType,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);
    
    const newPhoto: Photo = {
      id: uuidv4(),
      url: publicUrlData.publicUrl,
      name: originalName + ext,
      size: buffer.length,
      type: contentType,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    
    const { error: dbError } = await supabase.from('photos').insert([newPhoto]);
    if (dbError) throw dbError;
    
    res.status(201).json([newPhoto]);
  } catch (error) {
    console.error('Error downloading from URL:', error);
    res.status(500).json({ error: 'Failed to download image from the provided URL' });
  }
});

app.delete('/api/photos/:id', async (req, res) => {
  if (!supabaseUrl) return res.status(500).json({ error: 'Supabase URL not configured' });
  const { id } = req.params;
  
  // Get photo to find filename
  const { data: photoData, error: checkError } = await supabase
    .from('photos')
    .select('url')
    .eq('id', id)
    .single();

  if (checkError || !photoData) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const fileName = photoData.url.split('/').pop();
  
  if (fileName) {
    await supabase.storage.from('photos').remove([fileName]);
  }

  const { error: deleteError } = await supabase.from('photos').delete().eq('id', id);
  if (deleteError) {
    return res.status(500).json({ error: 'Failed to delete photo' });
  }

  res.json({ message: 'Deleted successfully' });
});

app.post('/api/photos/:id/tag', async (req, res) => {
  if (!supabaseUrl) return res.status(500).json({ error: 'Supabase URL not configured' });
  const { id } = req.params;
  
  const { data: photo, error: fetchError } = await supabase
    .from('photos')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    const response = await fetch(photo.url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const result = await geminiModel.generateContent([
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: photo.type
        }
      },
      "Generate 5 relevant short tags for this image. Output only the tags separated by commas. (e.g. landscape, nature, sunset)"
    ]);

    const tags = result.response.text().split(',').map(t => t.trim().toLowerCase());
    const newTags = Array.from(new Set([...photo.tags, ...tags]));
    
    const { data: updateData, error: updateError } = await supabase
      .from('photos')
      .update({ tags: newTags })
      .eq('id', id)
      .select()
      .single();
      
    if (updateError) throw updateError;
    
    res.json(updateData);
  } catch (error) {
    console.error('AI Tagging error:', error);
    res.status(500).json({ error: 'Failed to generate tags' });
  }
});

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

  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
