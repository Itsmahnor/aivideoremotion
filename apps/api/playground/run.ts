/**
 * PLAYGROUND: test how Claude plans a SaaS video from a brief, using your skills + template contract.
 * No web app or database needed.
 *
 *   npm run playground -w @ai-video-studio/api -- inputs/01-problem-solution-30s.json --mock
 *   npm run playground -w @ai-video-studio/api -- inputs/01-problem-solution-30s.json
 */
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {brandKitSchema, briefSchema, collectText, getTotalDurationInFrames, onScreenWords} from '@ai-video-studio/schema';
import {generatePlan, FPS, type PlanInput} from '../src/ai/planner';
import {config} from '../src/config';

const flatInput = z.object({
  brand: z.object({
    name: z.string(),
    tone: z.string(),
    motionStyle: z.enum(['calm', 'energetic', 'playful', 'corporate']),
    donts: z.array(z.string()).default([]),
    look: z.enum(['light', 'dark']).default('light'),
  }),
  subtype: z.string(),
  durationSec: z.number(),
  aspectRatio: z.string(),
  audience: z.string(),
  goal: z.string(),
  tone: z.string(),
  productName: z.string(),
  oneLiner: z.string(),
  problem: z.string(),
  keyFeatures: z.array(z.object({title: z.string(), description: z.string()})),
  proof: z.unknown().optional(),
  cta: z.object({type: z.string(), text: z.string(), url: z.string()}),
  userPrompt: z.string(),
  assets: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        kind: z.string().default('screenshot'),
        label: z.string(),
        description: z.string().optional(),
        regions: z.array(z.object({label: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number()})).default([]),
      }),
    )
    .default([]),
});

const FIXTURES = path.resolve(process.cwd(), '../../packages/schema/src/fixtures');

const toPlanInput = (flat: z.infer<typeof flatInput>): PlanInput => {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, flat.brand.look === 'dark' ? 'brand-kit-dark.json' : 'brand-kit.json'), 'utf8'));
  const brand = brandKitSchema.parse({
    ...fixture,
    name: flat.brand.name,
    tone: flat.brand.tone,
    motionStyle: flat.brand.motionStyle,
    rules: {dos: fixture.rules.dos, donts: flat.brand.donts},
  });
  const brief = briefSchema.parse({
    videoType: 'saas-explainer',
    subtype: flat.subtype,
    aspectRatio: flat.aspectRatio,
    durationSec: flat.durationSec,
    userPrompt: flat.userPrompt,
    assets: flat.assets.map(({regions, ...asset}) => ({...asset, focusRegions: regions})),
    details: {
      productName: flat.productName,
      oneLiner: flat.oneLiner,
      problem: flat.problem,
      keyFeatures: flat.keyFeatures,
      proof: flat.proof,
      audience: flat.audience,
      goal: flat.goal,
      tone: flat.tone,
      cta: flat.cta,
    },
  });
  return {brand, brief};
};

const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}...`);

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const mock = args.includes('--mock');
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) {
    console.log('Usage: npm run playground -w @ai-video-studio/api -- inputs/<file>.json [--mock]');
    process.exit(1);
  }
  const name = path.basename(file, '.json');
  const input = toPlanInput(flatInput.parse(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'playground', file), 'utf8'))));
  const {brand, brief} = input;
  console.log(`\n> ${brief.details.productName} | ${brief.subtype} | ${brief.durationSec}s | ${brief.aspectRatio} | brand: ${brand.motionStyle}${mock ? ' | MOCK' : ''}\n`);

  const result = await generatePlan(input, {mock, log: (message) => console.log(`  ${message}`)});

  console.log(`Storyboard: ${result.storyboard.title}`);
  console.log('#   template             sec   words  text');
  result.storyboard.scenes.forEach((scene, index) => {
    const seconds = ((result.sceneJson.scenes[index]?.durationInFrames ?? 0) / FPS).toFixed(1);
    console.log(
      `${String(index + 1).padEnd(3)} ${scene.template.padEnd(20)} ${seconds.padStart(4)}  ${String(onScreenWords(scene.props)).padStart(5)}  ${cut(collectText(scene.props).join(' | '), 70)}`,
    );
  });
  const frames = getTotalDurationInFrames(result.sceneJson);
  console.log(`\nTotal: ${(frames / FPS).toFixed(1)}s (target ${brief.durationSec}s), ${frames} frames @ ${FPS}fps`);
  if (result.warnings.length) console.log('\nWarnings:\n- ' + result.warnings.join('\n- '));
  if (result.notes.length) console.log('\nCompiler notes:\n- ' + result.notes.join('\n- '));
  if (!mock) {
    const u = result.usage;
    console.log(`\nClaude (${config.model}): ${result.attempts} attempt(s) | input ${u.input} | output ${u.output} | cache read ${u.cacheRead} | cache write ${u.cacheWrite} | approx $${result.costUsd.toFixed(3)}`);
  }

  const outDir = path.resolve(process.cwd(), 'playground/out');
  fs.mkdirSync(outDir, {recursive: true});
  fs.writeFileSync(path.join(outDir, `${name}.storyboard.json`), JSON.stringify(result.storyboard, null, 2));
  fs.writeFileSync(path.join(outDir, `${name}.scene.json`), JSON.stringify(result.sceneJson, null, 2));
  fs.writeFileSync(path.join(outDir, `${name}.brand.json`), JSON.stringify(brand, null, 2));
  console.log(`\nSaved in playground/out/: ${name}.storyboard.json, ${name}.scene.json, ${name}.brand.json`);
  console.log(`Watch it:  npm run sync:playground   then   npm run studio   (open Playground-${name})\n`);
};

main().catch((error) => {
  console.error(`\nERROR: ${(error as Error).message}\n`);
  process.exit(1);
});
