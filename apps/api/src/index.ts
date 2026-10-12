import cors from 'cors';
import express, {type NextFunction, type Request, type Response} from 'express';
import {ZodError} from 'zod';
import {config} from './config';
import {router} from './routes';
import {dirs, ensureStorage} from './storage';

ensureStorage();

const app = express();
app.use(cors({origin: [config.webOrigin, 'http://127.0.0.1:5173', 'http://localhost:5173']}));
app.use(express.json({limit: '5mb'}));

// Uploaded screenshots and rendered videos. Remotion (browser Player and renderer) fetches assets from here.
app.use('/files', cors({origin: '*'}), express.static(config.storageDir, {index: false}));
app.use('/api', router);
app.get('/health', (_req, res) => {
  res.json({status: 'ok'});
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({error: 'Invalid request', issues: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)});
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(message);
  res.status(500).json({error: message});
});

app.listen(config.port, () => {
  console.log(`API listening on ${config.publicUrl}  (mock AI: ${config.mockAi ? 'on' : 'off'}, API key: ${config.apiKey ? 'set' : 'missing'})`);
  console.log(`Uploads and renders are stored in ${dirs.uploads.replace(/uploads$/, '')}`);
});
