import {z} from 'zod';

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a 6-digit hex color');

export const brandKitSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().describe('Absolute URL or a path inside packages/video/public'),
  colors: z.object({
    primary: hexColorSchema,
    secondary: hexColorSchema,
    accent: hexColorSchema,
    background: hexColorSchema,
    text: hexColorSchema,
  }),
  fonts: z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
  }),
  tone: z.string().min(1),
  motionStyle: z.enum(['calm', 'energetic', 'playful', 'corporate']),
  rules: z.object({
    dos: z.array(z.string()),
    donts: z.array(z.string()),
  }),
});

export type BrandKit = z.infer<typeof brandKitSchema>;
