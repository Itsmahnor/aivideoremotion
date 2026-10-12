import {z} from 'zod';

export const VIDEO_TYPES = ['saas-explainer'] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];

export const EXPLAINER_SUBTYPES = ['product-overview', 'feature-announcement', 'how-it-works', 'problem-solution'] as const;
export type ExplainerSubtype = (typeof EXPLAINER_SUBTYPES)[number];

export const AUDIENCES = ['founders', 'developers', 'marketers', 'enterprise', 'general'] as const;
export const GOALS = ['awareness', 'signups', 'demos', 'retention'] as const;
export const TONES = ['professional', 'friendly', 'bold', 'technical'] as const;
export const CTA_TYPES = ['trial', 'demo', 'website'] as const;

export const saasExplainerDetailsSchema = z.object({
  productName: z.string().min(1).max(30),
  oneLiner: z.string().min(1).max(100),
  problem: z.string().min(1).max(200),
  keyFeatures: z
    .array(z.object({title: z.string().min(1).max(40), description: z.string().min(1).max(140)}))
    .min(1)
    .max(5),
  proof: z
    .object({
      stats: z.array(z.string().min(1).max(60)).max(4).default([]),
      customerCount: z.string().max(40).optional(),
    })
    .optional(),
  audience: z.enum(AUDIENCES),
  goal: z.enum(GOALS),
  tone: z.enum(TONES),
  cta: z.object({
    type: z.enum(CTA_TYPES),
    text: z.string().min(1).max(40),
    url: z.string().min(1).max(60),
  }),
});

export type SaasExplainerDetails = z.infer<typeof saasExplainerDetailsSchema>;

export const NICHE_FIELDS = {
  'saas-explainer': [
    'productName',
    'oneLiner',
    'problem',
    'keyFeatures',
    'proof',
    'audience',
    'goal',
    'tone',
    'cta',
  ],
} as const satisfies Record<VideoType, readonly string[]>;
