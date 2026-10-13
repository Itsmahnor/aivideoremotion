import {z} from 'zod';

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a 6-digit hex color');
export const visualStyleSchema = z.enum(['modern-saas', 'minimal', 'cinematic', 'corporate', 'playful']);

const gradientSchema = z.object({
  enabled: z.boolean().default(false),
  from: hexColorSchema,
  to: hexColorSchema,
  angle: z.number().min(0).max(360).default(135),
});

const captionsSchema = z.object({
  enabled: z.boolean().default(false),
  style: z.enum(['clean', 'bold', 'highlight']).default('clean'),
});


export const brandKitSchema = z.object({
   gradient: gradientSchema.default({enabled: false, from: '#000000', to: '#000000', angle: 135}),
  visualStyle: visualStyleSchema.default('modern-saas'),
  captions: captionsSchema.default({enabled: false, style: 'clean'}),
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
