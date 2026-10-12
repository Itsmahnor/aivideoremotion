import type {ComponentType} from 'react';
import {TEMPLATE_META, TEMPLATE_NAMES, TEMPLATE_PROPS, type TemplateName} from '@ai-video-studio/schema';
import {CTAEndCard} from './CTAEndCard';
import {FeatureSpotlight} from './FeatureSpotlight';
import {HookStatement} from './HookStatement';
import {ProductReveal} from './ProductReveal';
import {ScreenshotShowcase} from './ScreenshotShowcase';
import {StepFlow} from './StepFlow';

type AnyProps = Record<string, unknown>;

export type SceneRegistryEntry = {
  component: ComponentType<AnyProps>;
  defaultDurationInFrames: number;
  sampleProps: AnyProps;
};

const entry = (component: unknown, defaultDurationInFrames: number, sampleProps: AnyProps): SceneRegistryEntry => ({
  component: component as ComponentType<AnyProps>,
  defaultDurationInFrames,
  sampleProps,
});

/** Central registry: one entry per template. Props schemas and metadata come from @ai-video-studio/schema. */
export const sceneRegistry: Record<TemplateName, SceneRegistryEntry> = {
  HookStatement: entry(HookStatement, 105, {
    line: 'Client work gets lost across chats, sheets and email',
    emphasisWords: ['lost'],
    subline: 'There is a calmer way to run an agency',
    style: 'word-by-word',
  }),
  ProductReveal: entry(ProductReveal, 120, {
    productName: 'Flowly',
    tagline: 'Project management built for small agencies',
    variant: 'rise',
  }),
  ScreenshotShowcase: entry(ScreenshotShowcase, 150, {
    screenshotUrl: 'samples/screenshots/dashboard.svg',
    focusRegion: {x: 0.68, y: 0.18, w: 0.28, h: 0.55},
    caption: 'Every deadline and approval in one place',
    callout: {label: 'Alerts panel', position: 'auto'},
    showCursor: true,
    device: 'browser',
  }),
  FeatureSpotlight: entry(FeatureSpotlight, 120, {
    icon: 'users',
    title: 'Client approvals',
    description: 'Clients approve work with one click, no email chains',
    layout: 'right',
  }),
  StepFlow: entry(StepFlow, 150, {
    title: 'Up and running in 3 steps',
    steps: [{label: 'Add your clients'}, {label: 'Share a board', description: 'Invite the team and the client'}, {label: 'Approve and ship'}],
  }),
  CTAEndCard: entry(CTAEndCard, 105, {
    cta: 'Start your free trial',
    url: 'flowly.example.com',
    subline: 'No credit card needed',
  }),
};

/** Props schemas keyed by template name, ready for createSceneJsonSchema(). */
export const getTemplateSchemas = () => TEMPLATE_PROPS;

export {TEMPLATE_META, TEMPLATE_NAMES};
