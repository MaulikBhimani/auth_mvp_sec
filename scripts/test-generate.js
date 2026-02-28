

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');
require('dotenv').config();

const structure = [
  'backend/config',
  'backend/controllers',
  'backend/middleware',
  'backend/models',
  'backend/prisma',
  'backend/routes',
  'backend/utils',
  'frontend/app/login',
  'frontend/app/signup',
  'frontend/components',
  'frontend/context',
  'frontend/services',
  'frontend/styles'
];

const root = path.join(__dirname, '..', 'test-output');
const zipPath = path.join(__dirname, '..', 'generated-structure.zip');

// Example project config used to generate READMEs; replace as needed
const exampleConfig = {
  projectName: 'MVPTemplate',
  frontend: 'Next.js 14',
  backend: 'Express + Mongoose',
  database: 'MongoDB',
  auth: 'bcrypt + JWT',
  fields: [
    { name: 'email', type: 'string' },
    { name: 'password', type: 'string' }
  ]
};

/* =========================
   CREATE FOLDERS
========================= */
async function makeDirs(rootDir, dirs, cfg) {
  for (const dir of dirs) {
    const full = path.join(rootDir, dir);

    fs.mkdirSync(full, { recursive: true });

    // Attempt to generate a README via Gemini; fallback if no API key or failure
    const prompt = `You are a developer assistant. Write a concise README for the folder named "${dir}" in a project called "${cfg.projectName}".\nTech: frontend=${cfg.frontend}; backend=${cfg.backend}; database=${cfg.database}; auth=${cfg.auth}.\nFields: ${(cfg.fields || []).map(f => f.name).join(', ')}.\nInclude purpose, files to add, quick usage notes, and any ENV variables needed.`;

    let content = await generateWithGemini(prompt);
    if (!content) {
      content = fallbackReadme(dir, cfg);
    }

    fs.writeFileSync(path.join(full, 'README.md'), content, { encoding: 'utf8' });
  }
}

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Try a few plausible endpoints / request styles for Gemini / Generative Language
  const tried = [];
  const endpoints = [
    process.env.GEMINI_ENDPOINT,
    'https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText',
    'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText',
    'https://generativelanguage.googleapis.com/v1/models/text-bison-001:generate',
    'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate',
  ].filter(Boolean);

  // two request shapes to try
  const bodies = [
    { prompt: { text: prompt }, temperature: 0.2, maxOutputTokens: 512 },
    { input: prompt },
    { instances: [{ input: prompt }] }
  ];

  for (const ep of endpoints) {
    for (const body of bodies) {
      // try with key as query param
      const url = `${ep}?key=${apiKey}`;
      tried.push(url);
      try {
        const res = await axios.post(url, body, { timeout: 20000 });
        // Accept many possible response shapes
        const data = res.data || {};
        if (data?.candidates && data.candidates[0]) return data.candidates[0].output || data.candidates[0].content || JSON.stringify(data.candidates[0]);
        if (data?.output && data.output[0] && data.output[0].content) return data.output[0].content;
        if (typeof data?.text === 'string') return data.text;
        if (typeof data?.result === 'string') return data.result;
        // sometimes API returns top-level 'candidates' or 'outputs' as strings
        if (data && Object.keys(data).length) return JSON.stringify(data);
      } catch (err) {
        const status = err.response?.status;
        // if 404 or 401, continue trying other endpoints
        console.error(`Gemini endpoint ${ep} returned ${status || err.message}`);
      }

      // try with Authorization header (some setups require Bearer)
      try {
        const res2 = await axios.post(ep, body, { timeout: 20000, headers: { Authorization: `Bearer ${apiKey}` } });
        const data = res2.data || {};
        if (data?.candidates && data.candidates[0]) return data.candidates[0].output || data.candidates[0].content || JSON.stringify(data.candidates[0]);
        if (data?.output && data.output[0] && data.output[0].content) return data.output[0].content;
        if (typeof data?.text === 'string') return data.text;
        if (data && Object.keys(data).length) return JSON.stringify(data);
      } catch (err2) {
        console.error(`Gemini endpoint ${ep} (header) error:`, err2.response?.status || err2.message);
      }
    }
  }

  console.error('Gemini: tried endpoints:', tried);
  return null;
}

function fallbackReadme(dir, cfg) {
  const fieldsList = (cfg.fields || []).map(f => `- ${f.name} (${f.type || 'string'})`).join('\n');
  return `# ${dir}\n\nThis folder is part of the generated project "${cfg.projectName}".\n\nTech stack:\n- Frontend: ${cfg.frontend}\n- Backend: ${cfg.backend}\n- Database: ${cfg.database}\n- Auth: ${cfg.auth}\n\nFields:\n${fieldsList}\n\nPurpose:\nFiles in this directory relate to ${dir}. Add implementation files as needed.\n`;
}

// Write runnable example files for backend + frontend using selected fields
function writeExampleFiles(rootDir, cfg) {
  const backend = path.join(rootDir, 'backend');
  const frontend = path.join(rootDir, 'frontend');

  // ensure base dirs
  fs.mkdirSync(backend, { recursive: true });
  fs.mkdirSync(frontend, { recursive: true });

  // --- backend package.json
  const backendPkg = {
    name: `${cfg.projectName.toLowerCase()}-backend`,
    version: '0.1.0',
    private: true,
    scripts: { dev: 'nodemon server.js', start: 'node server.js' },
    dependencies: { express: '^4.18.2', mongoose: '^7.0.0', bcrypt: '^5.1.0', jsonwebtoken: '^9.0.0', dotenv: '^16.0.0', cors: '^2.8.5' },
    devDependencies: { nodemon: '^2.0.22' }
  };
  fs.writeFileSync(path.join(backend, 'package.json'), JSON.stringify(backendPkg, null, 2));

  // backend .env.example
  fs.writeFileSync(path.join(backend, '.env.example'), 'PORT=3000\nMONGO_URI=\nJWT_SECRET=your_jwt_secret\n');

  // backend server.js
  const serverJs = `const express = require('express');\nconst cors = require('cors');\nconst dotenv = require('dotenv');\nconst connectDB = require('./config/db');\nconst authRoutes = require('./routes/authRoutes');\nconst postRoutes = require('./routes/postRoutes');\n\ndotenv.config();\nconst app = express();\napp.use(cors());\napp.use(express.json());\nconnectDB();\napp.use('/auth', authRoutes);\napp.use('/api/posts', postRoutes);\nconst port = process.env.PORT || 3000;\napp.listen(port, () => console.log('Server running on', port));\n`;
  fs.writeFileSync(path.join(backend, 'server.js'), serverJs);

  // backend config/db.js
  const dbJs = `const mongoose = require('mongoose');\nmodule.exports = function connectDB(){\n  const url = process.env.MONGO_URI || process.env.DATABASE_URL;\n  if(!url) { console.warn('No MONGO_URI set'); return; }\n  mongoose.connect(url).then(()=>console.log('MongoDB connected')).catch(err=>console.error(err));\n};\n`;
  fs.mkdirSync(path.join(backend, 'config'), { recursive: true });
  fs.writeFileSync(path.join(backend, 'config', 'db.js'), dbJs);

  // create User model
  fs.mkdirSync(path.join(backend, 'models'), { recursive: true });
  const userModel = `const mongoose = require('mongoose');\nconst Schema = mongoose.Schema;\nconst UserSchema = new Schema({\n  email: { type: String, required: true, unique: true },\n  name: { type: String },\n  passwordHash: { type: String, required: true },\n  createdAt: { type: Date, default: Date.now }\n});\nmodule.exports = mongoose.model('User', UserSchema);\n`;
  fs.writeFileSync(path.join(backend, 'models', 'User.js'), userModel);

  // create Post model from cfg.fields
  const schemaFields = (cfg.fields || []).map(f => `  ${f.name}: { type: String${f.required ? ', required: true' : ''} }`).join(',\n');
  const postModel = `const mongoose = require('mongoose');\nconst Schema = mongoose.Schema;\nconst PostSchema = new Schema({\n${schemaFields || "  title: { type: String, required: true }"}\n}, { timestamps: true });\nmodule.exports = mongoose.model('Post', PostSchema);\n`;
  fs.writeFileSync(path.join(backend, 'models', 'Post.js'), postModel);

  // controllers: authController + postController
  fs.mkdirSync(path.join(backend, 'controllers'), { recursive: true });
  const authController = `const bcrypt = require('bcrypt');\nconst User = require('../models/User');\nconst generateToken = require('../utils/generateToken');\n\nexports.signup = async (req, res) => {\n  try {\n    const { email, name, password } = req.body;\n    if(!email || !password) return res.status(400).json({ error: 'Missing fields' });\n    const salt = await bcrypt.genSalt(10);\n    const hash = await bcrypt.hash(password, salt);\n    const user = await User.create({ email, name, passwordHash: hash });\n    const token = generateToken(user);\n    res.status(201).json({ token });\n  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }\n};\n\nexports.login = async (req, res) => {\n  try {\n    const { email, password } = req.body;\n    const user = await User.findOne({ email });\n    if(!user) return res.status(400).json({ error: 'Invalid credentials' });\n    const valid = await bcrypt.compare(password, user.passwordHash);\n    if(!valid) return res.status(400).json({ error: 'Invalid credentials' });\n    const token = generateToken(user);\n    res.json({ token });\n  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }\n};\n`;
  fs.writeFileSync(path.join(backend, 'controllers', 'authController.js'), authController);

  const postController = `const Post = require('../models/Post');\n\nexports.createPost = async (req, res) => {\n  try {\n    const post = await Post.create(req.body);\n    res.status(201).json(post);\n  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }\n};\n\nexports.getPosts = async (req, res) => {\n  try {\n    const posts = await Post.find().sort({ createdAt: -1 });\n    res.json(posts);\n  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }\n};\n\nexports.updatePost = async (req, res) => {\n  try {\n    const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });\n    if(!post) return res.status(404).json({ error: 'Not found' });\n    res.json(post);\n  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }\n};\n\nexports.deletePost = async (req, res) => {\n  try {\n    const post = await Post.findByIdAndDelete(req.params.id);\n    if(!post) return res.status(404).json({ error: 'Not found' });\n    res.json({ success: true });\n  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }\n};\n`;
  fs.writeFileSync(path.join(backend, 'controllers', 'postController.js'), postController);

  // routes
  fs.mkdirSync(path.join(backend, 'routes'), { recursive: true });
  const authRoutes = `const express = require('express');\nconst router = express.Router();\nconst { signup, login } = require('../controllers/authController');\nrouter.post('/signup', signup);\nrouter.post('/login', login);\nmodule.exports = router;\n`;
  fs.writeFileSync(path.join(backend, 'routes', 'authRoutes.js'), authRoutes);

  const postRoutes = `const express = require('express');\nconst router = express.Router();\nconst { createPost, getPosts, updatePost, deletePost } = require('../controllers/postController');\nconst auth = require('../middleware/authMiddleware');\n\nrouter.post('/', auth, createPost);\nrouter.get('/', auth, getPosts);\nrouter.put('/:id', auth, updatePost);\nrouter.delete('/:id', auth, deletePost);\n\nmodule.exports = router;\n`;
  fs.writeFileSync(path.join(backend, 'routes', 'postRoutes.js'), postRoutes);

  // middleware
  fs.mkdirSync(path.join(backend, 'middleware'), { recursive: true });
  const authMiddleware = `const jwt = require('jsonwebtoken');\nmodule.exports = function (req,res,next){\n  const auth = req.headers.authorization;\n  if(!auth) return res.status(401).json({ error: 'Unauthorized' });\n  const token = auth.split(' ')[1];\n  try{ const dec = jwt.verify(token, process.env.JWT_SECRET); req.user = dec; next(); } catch(e){ res.status(401).json({ error: 'Unauthorized' }); }\n};\n`;
  fs.writeFileSync(path.join(backend, 'middleware', 'authMiddleware.js'), authMiddleware);

  // utils generateToken
  fs.mkdirSync(path.join(backend, 'utils'), { recursive: true });
  const genToken = `const jwt = require('jsonwebtoken');\nmodule.exports = function generateToken(user){\n  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });\n};\n`;
  fs.writeFileSync(path.join(backend, 'utils', 'generateToken.js'), genToken);

  // --- frontend package.json
  const frontendPkg = { name: `${cfg.projectName.toLowerCase()}-frontend`, version: '0.1.0', private: true, scripts: { dev: 'next dev', build: 'next build', start: 'next start' }, dependencies: { next: '^14.0.0', react: '^18.2.0', 'react-dom': '^18.2.0', axios: '^1.4.0' } };
  fs.writeFileSync(path.join(frontend, 'package.json'), JSON.stringify(frontendPkg, null, 2));
  fs.writeFileSync(path.join(frontend, '.env.local'), 'NEXT_PUBLIC_API_URL=http://localhost:3000\n');

  // frontend services/api.js
  fs.mkdirSync(path.join(frontend, 'services'), { recursive: true });
  const apiJs = "import axios from 'axios';\nconst API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';\nconst api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });\napi.interceptors.request.use((config) => { const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null; if (token) config.headers.Authorization = 'Bearer ' + token; return config; });\nexport default api;\n";
  fs.writeFileSync(path.join(frontend, 'services', 'api.js'), apiJs);

  // frontend services/postsAPI.js
  const postsAPIJs = "import api from './api';\nexport const postsAPI = { getPosts: () => api.get('/api/posts'), createPost: (data) => api.post('/api/posts', data), updatePost: (id, data) => api.put('/api/posts/' + id, data), deletePost: (id) => api.delete('/api/posts/' + id) };\n";
  fs.writeFileSync(path.join(frontend, 'services', 'postsAPI.js'), postsAPIJs);

  // frontend components/PostTable.jsx
  fs.mkdirSync(path.join(frontend, 'components'), { recursive: true });
  const postTable = `'use client';\nimport React from 'react';\nexport default function PostTable({ posts = [] }) { return (<div>\n  <h2>Posts</h2>\n  {posts.length === 0 ? (<div>No posts yet.</div>) : ( <table style={{ width: '100%' }}> <thead><tr><th>Title</th><th>Description</th></tr></thead><tbody>{posts.map(p => (<tr key={p._id}><td>{p.title}</td><td>{p.description}</td></tr>))}</tbody></table>)}\n</div>); }\n`;
  fs.writeFileSync(path.join(frontend, 'components', 'PostTable.jsx'), postTable);

  // frontend app pages
  fs.mkdirSync(path.join(frontend, 'app'), { recursive: true });
  const homePage = `'use client';\nexport default function Home(){ return (<main style={{ padding: 40 }}><h1>Welcome to ${cfg.projectName}</h1><p><a href="/login">Login</a> or <a href="/signup">Sign up</a></p></main>); }\n`;
  fs.writeFileSync(path.join(frontend, 'app', 'page.jsx'), homePage);

  const loginPage = `'use client';\nimport { useState } from 'react';\nimport axios from 'axios';\nimport { useRouter } from 'next/navigation';\nexport default function Login(){ const router = useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [err,setErr]=useState(''); const handle=async(e)=>{e.preventDefault(); try{ const res = await axios.post((process.env.NEXT_PUBLIC_API_URL||'http://localhost:3000') + '/auth/login',{ email, password }); localStorage.setItem('auth_token', res.data.token); router.push('/dashboard'); }catch(e){ setErr(e.response?.data?.error||'Login failed'); } }; return (<main style={{ padding: 40 }}><h1>Login</h1>{err && <div style={{ color: 'red' }}>{err}</div>}<form onSubmit={handle}><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/><br/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/><br/><button type="submit">Login</button></form></main>); }\n`;
  fs.writeFileSync(path.join(frontend, 'app', 'login', 'page.jsx'), loginPage);

  const signupPage = `'use client';\nimport { useState } from 'react';\nimport axios from 'axios';\nimport { useRouter } from 'next/navigation';\nexport default function Signup(){ const router = useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [name,setName]=useState(''); const [err,setErr]=useState(''); const handle=async(e)=>{e.preventDefault(); try{ const res = await axios.post((process.env.NEXT_PUBLIC_API_URL||'http://localhost:3000') + '/auth/signup',{ email, name, password }); localStorage.setItem('auth_token', res.data.token); router.push('/dashboard'); }catch(e){ setErr(e.response?.data?.error||'Signup failed'); } }; return (<main style={{ padding: 40 }}><h1>Sign Up</h1>{err && <div style={{ color: 'red' }}>{err}</div>}<form onSubmit={handle}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" required/><br/><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required/><br/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" required/><br/><button type="submit">Sign Up</button></form></main>); }\n`;
  fs.writeFileSync(path.join(frontend, 'app', 'signup', 'page.jsx'), signupPage);

  const dashboardPage = "'use client';\nimport { useState, useEffect } from 'react';\nimport axios from 'axios';\nimport PostTable from '../components/PostTable';\nexport default function Dashboard(){ const [posts,setPosts]=useState([]); useEffect(()=>{ const t=localStorage.getItem('auth_token'); if(!t){ window.location.href = '/login'; return; } axios.get((process.env.NEXT_PUBLIC_API_URL||'http://localhost:3000') + '/api/posts',{ headers: { Authorization: 'Bearer ' + localStorage.getItem('auth_token') } }).then(r=>setPosts(r.data)).catch(()=>{}); },[]); return (<main style={{ padding: 40 }}><h1>Dashboard</h1><PostTable posts={posts} /></main>); }\n";
  fs.mkdirSync(path.join(frontend, 'app', 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(frontend, 'app', 'dashboard', 'page.jsx'), dashboardPage);

  // styles
  fs.mkdirSync(path.join(frontend, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(frontend, 'styles', 'globals.css'), `html,body{font-family:system-ui,Segoe UI,Roboto,sans-serif;padding:0;margin:0}main{max-width:900px;margin:40px auto}`);
}

/* =========================
   ZIP DIRECTORY
========================= */
function zipDir(sourceDir, outputFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Archive created: ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/* =========================
   RUN SCRIPT
========================= */
async function run() {
  try {
    // Remove old test-output if exists
    if (fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true });
    }

    if (fs.existsSync(zipPath)) {
      fs.rmSync(zipPath, { force: true });
    }

    console.log('Creating folder structure...');
    await makeDirs(root, structure, exampleConfig);
    console.log('Structure created at:', root);

    // write runnable example files so the archived structure is executable
    try {
      writeExampleFiles(root, exampleConfig);
      console.log('Wrote example runnable files into:', root);
    } catch (e) {
      console.warn('Failed to write example files:', e.message);
    }

    console.log('Creating zip archive...');
    await zipDir(root, zipPath);

    console.log('Zip file saved at:', zipPath);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();