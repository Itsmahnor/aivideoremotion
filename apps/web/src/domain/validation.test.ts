import {describe, expect, it} from 'vitest';
import {emptyConfig, sampleConfig} from './defaults';
import {composeDirection, toBrief} from './mapping';
import type {ProjectConfig} from './schemas';
import {checkUrl, validateCustomization, validateProduct, validateScript} from './validation';
import {FONTS, sampleScript} from '../test/fixtures';
import {briefSchema} from '@ai-video-studio/schema';

const withProduct = (patch: Partial<ProjectConfig['product']>): ProjectConfig => {
  const config = sampleConfig();
  return {...config, product: {...config.product, ...patch}};
};

describe('step 1: product details', () => {
  it('reports every required field when empty', () => {
    const errors = validateProduct(emptyConfig());
    expect(Object.keys(errors).sort()).toEqual(
      ['product.cta.text', 'product.cta.url', 'product.features.0.description', 'product.features.0.title', 'product.goal', 'product.oneLiner', 'product.problem', 'product.productName', 'product.targetAudience'].sort(),
    );
  });

  it('treats whitespace-only input as empty', () => {
    const errors = validateProduct(withProduct({productName: '    ', problem: '\n\t '}));
    expect(errors['product.productName']).toMatch(/required/);
    expect(errors['product.problem']).toMatch(/required/);
  });

  it('trims before checking length limits', () => {
    expect(validateProduct(withProduct({productName: '  A  '}))['product.productName']).toMatch(/at least 2/);
    expect(validateProduct(withProduct({productName: `  ${'x'.repeat(30)}  `}))['product.productName']).toBeUndefined();
    expect(validateProduct(withProduct({productName: 'x'.repeat(31)}))['product.productName']).toMatch(/at most 30/);
    expect(validateProduct(withProduct({description: 'x'.repeat(601)}))['product.description']).toMatch(/at most 600/);
  });

  it('keeps optional fields optional', () => {
    const errors = validateProduct(withProduct({description: '', benefits: '', objectiveNotes: '', customerCount: ''}));
    expect(errors).toEqual({});
  });

  it('validates the call-to-action link', () => {
    expect(checkUrl('yourapp.com/start')).toBeUndefined();
    expect(checkUrl('https://app.example.io')).toBeUndefined();
    expect(checkUrl('not a url')).toMatch(/web address/);
    expect(checkUrl('http://')).toBeDefined();
    expect(checkUrl('')).toMatch(/required/);
  });

  it('rejects duplicate feature names', () => {
    const config = sampleConfig();
    const features = [config.product.features[0]!, {...config.product.features[0]!, id: 'dup'}];
    expect(validateProduct(withProduct({features}))['product.features.1.title']).toMatch(/different name/);
  });

  it('accepts the sample inputs and maps them to a valid Brief', () => {
    const config = sampleConfig();
    expect(validateProduct(config)).toEqual({});
    expect(briefSchema.safeParse(toBrief(config)).success).toBe(true);
  });

  it('never sends a prompt longer than the API accepts', () => {
    const config = withProduct({description: 'x'.repeat(600), benefits: 'y'.repeat(300), targetAudience: 'z'.repeat(120), objectiveNotes: 'w'.repeat(150)});
    expect(composeDirection(config).length).toBeLessThanOrEqual(1500);
    expect(briefSchema.safeParse(toBrief(config)).success).toBe(true);
  });
});

describe('step 2: customization', () => {
  it('has valid defaults (optional settings never block)', () => {
    expect(validateCustomization(sampleConfig(), FONTS)).toEqual({});
  });

  it('rejects unsupported fonts and empty screenshot labels', () => {
    const config = sampleConfig();
    config.brand.fonts.heading = 'Comic Sans MS';
    config.assets = [{id: 'a1', url: 'http://x/a.png', kind: 'screenshot', label: '  ', focusRegions: []}];
    const errors = validateCustomization(config, FONTS);
    expect(errors['brand.fonts.heading']).toBeDefined();
    expect(errors['assets.a1.label']).toMatch(/required/);
  });
});

describe('step 3: storyboard', () => {
  it('cannot approve an empty storyboard', () => {
    expect(validateScript(null, sampleConfig()).valid).toBe(false);
    const script = {...sampleScript(), scenes: []};
    const result = validateScript(script, sampleConfig());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/empty/);
  });

  it('accepts the example plan for the sample inputs', () => {
    const result = validateScript(sampleScript(), sampleConfig());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('reports field errors on the scene that has them', () => {
    const script = sampleScript();
    script.scenes[0]!.props = {...script.scenes[0]!.props, line: ''};
    const result = validateScript(script, sampleConfig());
    expect(result.valid).toBe(false);
    expect(result.scenes[script.scenes[0]!.id]?.fields.line).toBeDefined();
  });

  it('enforces storyboard rules shared with the AI planner', () => {
    const script = sampleScript();
    script.scenes = script.scenes.filter((s) => s.template !== 'CTAEndCard');
    const result = validateScript(script, sampleConfig());
    expect(result.errors.join(' ')).toMatch(/Last scene must be CTAEndCard/);
  });

  it('requires highlighted words to appear in the hook line', () => {
    const script = sampleScript();
    script.scenes[0]!.props = {...script.scenes[0]!.props, emphasisWords: ['banana']};
    expect(validateScript(script, sampleConfig()).scenes[script.scenes[0]!.id]?.fields.emphasisWords).toMatch(/banana/);
  });

  it('flags durations outside 3 to 8 seconds and overlong narration', () => {
    const script = sampleScript();
    script.scenes[1]!.durationSec = 12;
    script.scenes[1]!.narration = 'x'.repeat(301);
    const fields = validateScript(script, sampleConfig()).scenes[script.scenes[1]!.id]!.fields;
    expect(fields.durationSec).toBeDefined();
    expect(fields.narration).toMatch(/at most 140/);
  });

  it('flags a scene that points at a removed screenshot', () => {
    const script = sampleScript();
    script.scenes[1]!.assetId = 'gone';
    expect(validateScript(script, sampleConfig()).valid).toBe(false);
  });
});
