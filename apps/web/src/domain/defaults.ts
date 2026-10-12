import brandFixture from '@ai-video-studio/schema/fixtures/brand-kit.json';
import briefFixture from '@ai-video-studio/schema/fixtures/brief-saas-16x9.json';
import {brandKitSchema, briefSchema} from '@ai-video-studio/schema';
import type {BrandSettings, Feature, ProjectConfig, RenderState, VideoSettings, VisualStyle} from './schemas';

let counter = 0;
/** Stable-enough ids for list keys. Not used for anything security related. */
export const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const emptyFeature = (): Feature => ({id: newId('f'), title: '', description: ''});

export const defaultBrand: BrandSettings = {
  name: '',
  logoUrl: '',
  colors: {primary: '#4F46E5', secondary: '#0EA5E9', accent: '#F59E0B', background: '#F8FAFC', text: '#0F172A'},
  gradient: {enabled: false, from: '#4F46E5', to: '#0EA5E9', angle: 135},
  fonts: {heading: 'Plus Jakarta Sans', body: 'Inter'},
  tone: '',
  rules: {dos: [], donts: []},
};

export const emptyConfig = (): ProjectConfig => ({
  product: {
    productName: '',
    oneLiner: '',
    description: '',
    problem: '',
    features: [emptyFeature()],
    benefits: '',
    targetAudience: '',
    audienceSegment: 'general',
    goal: '',
    objectiveNotes: '',
    tone: 'friendly',
    cta: {type: 'trial', text: '', url: ''},
    customerCount: '',
  },
  brand: defaultBrand,
  video: {
    subtype: 'product-overview',
    aspectRatio: '16:9',
    durationSec: 30,
    visualStyle: 'modern-saas',
    motionStyle: 'energetic',
    voiceover: {enabled: false, voice: 'neutral', language: 'English'},
    captions: {enabled: false, style: 'clean'},
  },
  assets: [],
});

export const idleRender: RenderState = {phase: 'idle', progress: 0};

/** Picking a visual style suggests an animation feel. The user can still change it afterwards. */
export const STYLE_MOTION: Record<VisualStyle, VideoSettings['motionStyle']> = {
  'modern-saas': 'energetic',
  minimal: 'calm',
  cinematic: 'calm',
  corporate: 'corporate',
  playful: 'playful',
};

/**
 * SAMPLE DATA: a fictional product ("Flowly") for trying the workflow.
 * It only fills in the input forms. It never produces a script or a video by itself.
 */
export const sampleConfig = (): ProjectConfig => {
  const brand = brandKitSchema.parse(brandFixture);
  const brief = briefSchema.parse(briefFixture);
  const base = emptyConfig();
  return {
    product: {
      ...base.product,
      productName: brief.details.productName,
      oneLiner: brief.details.oneLiner,
      description:
        'Flowly is a project management tool for small creative agencies. It keeps every client project, task, deadline and approval on one shared board so nothing gets lost in chats or email.',
      problem: brief.details.problem,
      features: brief.details.keyFeatures.map((feature) => ({...feature, id: newId('f')})),
      benefits: 'Fewer status meetings, faster client sign-off and a clear view of which projects make money.',
      targetAudience: 'Founders and project leads at agencies with 5 to 50 people',
      audienceSegment: brief.details.audience,
      goal: brief.details.goal,
      objectiveNotes: 'Drive free-trial signups from the website hero section.',
      tone: brief.details.tone,
      cta: {...brief.details.cta},
    },
    brand: {
      ...defaultBrand,
      name: brand.name,
      logoUrl: brand.logoUrl,
      colors: brand.colors,
      gradient: {enabled: true, from: brand.colors.primary, to: brand.colors.secondary, angle: 135},
      fonts: brand.fonts,
      tone: brand.tone,
      rules: brand.rules,
    },
    video: {...base.video, subtype: brief.subtype, aspectRatio: brief.aspectRatio, durationSec: brief.durationSec, visualStyle: 'minimal', motionStyle: brand.motionStyle},
    assets: [],
  };
};
