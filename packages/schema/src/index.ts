import {z} from 'zod';

export const brandThemeSchema = z.object({
  colors: z.object({
    background: z.string(),
    foreground: z.string(),
  }),
  fonts: z.object({
    body: z.string(),
  }),
});

export type BrandTheme = z.infer<typeof brandThemeSchema>;

export const testCompositionSchema = z.object({
  title: z.string(),
  theme: brandThemeSchema,
});

export type TestCompositionProps = z.infer<typeof testCompositionSchema>;

export * from './assets';
export * from './brand-kit';
export * from './brief';
export * from './niche';
export * from './scene-json';
export * from './storyboard';
export * from './templates';
