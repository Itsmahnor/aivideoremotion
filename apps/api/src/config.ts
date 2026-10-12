import 'dotenv/config';
import path from 'node:path';
import {z} from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  /** "1" = never call Claude, use the built-in mock planner (free, for testing the app). */
  MOCK_AI: z.enum(['0', '1']).default('0'),
  PUBLIC_URL: z.string().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  /** Optional path to a Chrome/Chromium binary for rendering. Remotion downloads one itself if unset. */
  REMOTION_BROWSER_EXECUTABLE: z.string().optional(),
});

const env = envSchema.parse(process.env);

/** All paths assume the API is started from apps/api (npm run dev -w @ai-video-studio/api). */
export const config = {
  port: env.PORT,
  apiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
  model: env.ANTHROPIC_MODEL,
  mockAi: env.MOCK_AI === '1',
  publicUrl: env.PUBLIC_URL ?? `http://localhost:${env.PORT}`,
  webOrigin: env.WEB_ORIGIN,
  browserExecutable: env.REMOTION_BROWSER_EXECUTABLE?.trim() || undefined,
  storageDir: path.resolve(process.cwd(), 'storage'),
  skillsDir: path.resolve(process.cwd(), 'src/skills'),
  repoRoot: path.resolve(process.cwd(), '../..'),
};
