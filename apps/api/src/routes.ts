import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Router, type NextFunction, type Request, type RequestHandler, type Response} from 'express';
import multer from 'multer';
import {imageSize} from 'image-size';
import {z} from 'zod';
import {
  TEMPLATE_PROPS,
  brandKitSchema,
  briefSchema,
  createSceneJsonSchema,
  uploadedAssetSchema,
  type UploadedAsset,
} from '@ai-video-studio/schema';
import {buildFullPrompt, generatePlan, importStoryboard} from './ai/planner';
import {addUsage, costUsd, emptyUsage} from './ai/usage';
import {analyzeAsset} from './ai/vision';
import {config} from './config';
import {enqueueRender, getJob} from './render';
import {dirs, readJson, SAFE_ID, writeJson} from './storage';

const wrap =
  (handler: (req: Request, res: Response) => Promise<void> | void): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };

const UPLOAD_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => done(null, dirs.uploads),
    filename: (_req, file, done) => {
      const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
      done(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: {fileSize: 5 * 1024 * 1024, files: 1},
  fileFilter: (_req, file, done) => done(null, UPLOAD_TYPES.has(file.mimetype)),
});

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({status: 'ok', mockAi: config.mockAi, hasApiKey: Boolean(config.apiKey), model: config.model});
});

// ---- uploads -------------------------------------------------------------------------------

router.post(
  '/uploads',
  upload.single('file'),
  wrap((req, res) => {
    if (!req.file) {
      res.status(400).json({error: 'Upload a png, jpg or webp image up to 5MB (field name: file).'});
      return;
    }
    const size = imageSize(fs.readFileSync(req.file.path));
    const kind = req.body?.kind === 'logo' ? 'logo' : 'screenshot';
    const label = String(req.body?.label || path.parse(req.file.originalname).name).slice(0, 60) || 'Screenshot';
    const asset: UploadedAsset = uploadedAssetSchema.parse({
      id: path.parse(req.file.filename).name,
      url: `${config.publicUrl}/files/uploads/${req.file.filename}`,
      kind,
      label,
      width: size.width,
      height: size.height,
      focusRegions: [],
    });
    res.json(asset);
  }),
);

router.post(
  '/assets/analyze',
  wrap(async (req, res) => {
    const asset = uploadedAssetSchema.parse(req.body?.asset);
    const result = await analyzeAsset(asset, {mock: req.body?.mock === true ? true : undefined});
    res.json({asset: result.asset, costUsd: costUsd(result.usage)});
  }),
);

// ---- plan ----------------------------------------------------------------------------------

const planBody = z.object({brand: brandKitSchema, brief: briefSchema, mock: z.boolean().optional()});

router.post(
  '/plan',
  wrap(async (req, res) => {
    const {brand, brief, mock} = planBody.parse(req.body);
    const useMock = mock ?? config.mockAi;
    let usage = emptyUsage();

    // Describe screenshots first (cached), so the director knows what is on screen.
    const assets: UploadedAsset[] = [];
    for (const asset of brief.assets) {
      const analyzed = await analyzeAsset(asset, {mock: useMock});
      usage = addUsage(usage, analyzed.usage);
      assets.push(analyzed.asset);
    }
    const analyzedBrief = {...brief, assets};

    const plan = await generatePlan({brand, brief: analyzedBrief}, {mock: useMock});
    usage = addUsage(usage, plan.usage);
    res.json({...plan, assets, usage, costUsd: costUsd(usage)});
  }),
);

const promptBody = z.object({brand: brandKitSchema, brief: briefSchema});

// Use Claude without an API key: copy this prompt into claude.ai, then paste the JSON reply into /plan/import.
router.post(
  '/plan/prompt',
  wrap((req, res) => {
    const {brand, brief} = promptBody.parse(req.body);
    res.json({prompt: buildFullPrompt({brand, brief})});
  }),
);

router.post(
  '/plan/import',
  wrap((req, res) => {
    const {brand, brief} = promptBody.parse(req.body);
    const text = z.string().min(2).parse(req.body?.text);
    try {
      const plan = importStoryboard({brand, brief}, text);
      res.json({...plan, assets: brief.assets});
    } catch (error) {
      res.status(400).json({error: (error as Error).message});
    }
  }),
);

// ---- projects (simple JSON files; swap for MongoDB later) -----------------------------------

const projectBody = z.object({
  id: z.string().regex(SAFE_ID).optional(),
  name: z.string().min(1).max(80),
  brand: brandKitSchema,
  brief: briefSchema,
  plan: z.unknown().optional(),
});

router.get(
  '/projects',
  wrap((_req, res) => {
    const items = fs
      .readdirSync(dirs.projects)
      .filter((file) => file.endsWith('.json'))
      .map((file) => readJson<{id: string; name: string; updatedAt: string}>(path.join(dirs.projects, file)))
      .filter((item): item is {id: string; name: string; updatedAt: string} => item !== null)
      .map(({id, name, updatedAt}) => ({id, name, updatedAt}))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json(items);
  }),
);

router.post(
  '/projects',
  wrap((req, res) => {
    const body = projectBody.parse(req.body);
    const id = body.id ?? randomUUID();
    const project = {...body, id, updatedAt: new Date().toISOString()};
    writeJson(path.join(dirs.projects, `${id}.json`), project);
    res.json({id, updatedAt: project.updatedAt});
  }),
);

router.get(
  '/projects/:id',
  wrap((req, res) => {
    const id = String(req.params.id);
    const project = SAFE_ID.test(id) ? readJson(path.join(dirs.projects, `${id}.json`)) : null;
    if (!project) {
      res.status(404).json({error: 'Project not found.'});
      return;
    }
    res.json(project);
  }),
);

router.delete(
  '/projects/:id',
  wrap((req, res) => {
    const id = String(req.params.id);
    if (SAFE_ID.test(id)) fs.rmSync(path.join(dirs.projects, `${id}.json`), {force: true});
    res.json({ok: true});
  }),
);

// ---- render --------------------------------------------------------------------------------

const renderBody = z.object({sceneJson: z.unknown(), brand: brandKitSchema, preset: z.enum(['draft', 'final']).default('draft')});

router.post(
  '/render',
  wrap((req, res) => {
    const body = renderBody.parse(req.body);
    const sceneJson = createSceneJsonSchema(TEMPLATE_PROPS).parse(body.sceneJson);
    const job = enqueueRender(sceneJson, body.brand, body.preset);
    res.json(job);
  }),
);

router.get(
  '/render/:id',
  wrap((req, res) => {
    const job = getJob(String(req.params.id));
    if (!job) {
      res.status(404).json({error: 'Render job not found.'});
      return;
    }
    res.json(job);
  }),
);
