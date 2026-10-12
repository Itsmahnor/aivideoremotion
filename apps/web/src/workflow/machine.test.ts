import {describe, expect, it} from 'vitest';
import {approved, readyForScript, run, sampleScript, withScript} from '../test/fixtures';
import {deriveStatus, hasDownloadableVideo, initialState, isApproved, isRenderCurrent, isScriptOutdated, type WorkflowState} from './machine';

const rendered = (): WorkflowState =>
  run(
    approved(),
    {type: 'render/requested', preset: 'draft'},
    {type: 'render/accepted', jobId: 'job-1', phase: 'queued', progress: 0},
    {type: 'render/progress', jobId: 'job-1', phase: 'rendering', progress: 0.5},
    {type: 'render/progress', jobId: 'job-1', phase: 'done', progress: 1, videoUrl: 'http://localhost:4000/files/renders/job-1.mp4'},
  );

describe('step navigation', () => {
  it('starts as a draft on step 1', () => {
    const state = initialState();
    expect(state.step).toBe('product');
    expect(deriveStatus(state)).toBe('draft');
  });

  it('blocks Next while required fields are invalid and shows all errors', () => {
    const state = run(initialState(), {type: 'step/next'});
    expect(state.step).toBe('product');
    expect(state.attempted.product).toBe(true);
    expect(state.notice?.tone).toBe('error');
  });

  it('blocks skipping ahead via the stepper (validated in the reducer, not only the UI)', () => {
    for (const step of ['customize', 'script', 'generate', 'export'] as const) {
      expect(run(initialState(), {type: 'step/go', step}).step).toBe('product');
    }
    const ready = readyForScript();
    expect(run(ready, {type: 'step/go', step: 'script'}).step).toBe('script');
    expect(run(ready, {type: 'step/go', step: 'generate'}).step).toBe('product');
    expect(run(withScript(), {type: 'step/go', step: 'export'}).step).not.toBe('export');
  });

  it('allows going back without losing input', () => {
    const forward = run(readyForScript(), {type: 'step/next'}, {type: 'step/next'});
    expect(forward.step).toBe('script');
    const back = run(forward, {type: 'step/back'}, {type: 'step/back'});
    expect(back.step).toBe('product');
    expect(back.config).toEqual(forward.config);
  });

  it('does not leave the script step until the script is approved', () => {
    const atScript = run(withScript(), {type: 'step/go', step: 'script'});
    expect(run(atScript, {type: 'step/next'}).step).toBe('script');
    const ok = run(atScript, {type: 'script/approve'}, {type: 'step/next'});
    expect(ok.step).toBe('generate');
  });

  it('blocks continuing from step 2 while uploads are running', () => {
    const state = run(readyForScript(), {type: 'step/next'}, {type: 'uploads/started'}, {type: 'step/next'});
    expect(state.step).toBe('customize');
    expect(run(state, {type: 'uploads/finished'}, {type: 'step/next'}).step).toBe('script');
  });
});

describe('script generation and approval', () => {
  it('refuses to generate from invalid inputs', () => {
    const state = run(initialState(), {type: 'script/requested'});
    expect(state.busy.script).toBe(false);
  });

  it('prevents duplicate generation requests', () => {
    const once = run(readyForScript(), {type: 'script/requested'});
    expect(once.busy.script).toBe(true);
    expect(deriveStatus(once)).toBe('validating');
    const twice = run(once, {type: 'script/requested'});
    expect(twice.notice?.text).toMatch(/already/);
  });

  it('records failures and ignores late responses after a reset', () => {
    const failed = run(readyForScript(), {type: 'script/requested'}, {type: 'script/failed', error: 'boom'});
    expect(failed.scriptError).toBe('boom');
    expect(deriveStatus(failed)).toBe('failed');
    const late = run(readyForScript(), {type: 'script/received', script: sampleScript()});
    expect(late.script).toBeNull();
  });

  it('moves from awaiting approval to approved', () => {
    const state = withScript();
    expect(deriveStatus(state)).toBe('awaiting_approval');
    const ok = run(state, {type: 'script/approve'});
    expect(isApproved(ok)).toBe(true);
    expect(deriveStatus(ok)).toBe('approved');
  });

  it('refuses to approve an invalid storyboard', () => {
    const state = withScript();
    const broken = run(state, {type: 'scene/update', id: state.script!.scenes[0]!.id, patch: {props: {line: ''}}});
    expect(deriveStatus(broken)).toBe('ready_for_review');
    const attempt = run(broken, {type: 'script/approve'});
    expect(isApproved(attempt)).toBe(false);
    expect(attempt.notice?.tone).toBe('error');
  });

  it('refuses to approve an empty storyboard', () => {
    let state = withScript();
    for (const scene of state.script!.scenes) state = run(state, {type: 'scene/remove', id: scene.id});
    expect(state.script!.scenes).toHaveLength(0);
    expect(isApproved(run(state, {type: 'script/approve'}))).toBe(false);
  });
});

describe('invalidation', () => {
  it('changing product details invalidates the approved script', () => {
    const state = approved();
    const changed = run(state, {type: 'config/update', section: 'product', update: (c) => ({...c, product: {...c.product, problem: `${c.product.problem} and more`}})});
    expect(isApproved(changed)).toBe(false);
    expect(isScriptOutdated(changed)).toBe(true);
    expect(run(changed, {type: 'step/go', step: 'generate'}).step).not.toBe('generate');
  });

  it('an outdated script needs explicit acknowledgement before re-approval', () => {
    const changed = run(approved(), {type: 'config/update', section: 'product', update: (c) => ({...c, product: {...c.product, oneLiner: 'A brand new one-liner for it'}})});
    expect(isApproved(run(changed, {type: 'script/approve'}))).toBe(false);
    const ok = run(changed, {type: 'script/approve', acknowledgeOutdated: true});
    expect(isApproved(ok)).toBe(true);
    expect(isScriptOutdated(ok)).toBe(false);
  });

  it('reverting an edit to exactly the approved content keeps the approval valid', () => {
    const state = approved();
    const id = state.script!.scenes[1]!.id;
    const original = state.script!.scenes[1]!.purpose;
    const edited = run(state, {type: 'scene/update', id, patch: {purpose: 'changed'}});
    expect(isApproved(edited)).toBe(false);
    const reverted = run(edited, {type: 'scene/update', id, patch: {purpose: original}});
    // Same content as what was approved -> the approval genuinely still applies.
    expect(isApproved(reverted)).toBe(true);
  });

  it('changing the storyboard invalidates the rendered video', () => {
    const state = rendered();
    expect(hasDownloadableVideo(state)).toBe(true);
    expect(deriveStatus(state)).toBe('completed');
    const edited = run(state, {type: 'scene/update', id: state.script!.scenes[2]!.id, patch: {narration: 'New narration'}});
    expect(isApproved(edited)).toBe(false);
    expect(isRenderCurrent(edited)).toBe(false);
    expect(hasDownloadableVideo(edited)).toBe(false);
  });

  it('changing brand colors keeps the approval but makes the video out of date', () => {
    const state = rendered();
    const recolored = run(state, {type: 'config/update', section: 'brand', update: (c) => ({...c, brand: {...c.brand, colors: {...c.brand.colors, primary: '#000000'}}})});
    expect(isApproved(recolored)).toBe(true);
    expect(hasDownloadableVideo(recolored)).toBe(false);
  });

  it('changing the format clears approval', () => {
    const state = approved();
    const vertical = run(state, {type: 'config/update', section: 'video', update: (c) => ({...c, video: {...c.video, aspectRatio: '9:16'}})});
    expect(isApproved(vertical)).toBe(false);
  });

  it('changing voice-over preferences does not invalidate anything', () => {
    const state = rendered();
    const prefs = run(state, {type: 'config/update', section: 'video', update: (c) => ({...c, video: {...c.video, voiceover: {...c.video.voiceover, enabled: true}}})});
    expect(isApproved(prefs)).toBe(true);
    expect(hasDownloadableVideo(prefs)).toBe(true);
  });
});

describe('rendering', () => {
  it('requires an approved script', () => {
    const state = run(withScript(), {type: 'render/requested', preset: 'draft'});
    expect(state.render.phase).toBe('idle');
  });

  it('prevents duplicate renders and editing while rendering', () => {
    const started = run(approved(), {type: 'render/requested', preset: 'draft'});
    expect(started.render.phase).toBe('submitting');
    expect(deriveStatus(started)).toBe('generating');
    expect(run(started, {type: 'render/requested', preset: 'final'}).render.preset).toBe('draft');
    const edit = run(started, {type: 'scene/update', id: started.script!.scenes[0]!.id, patch: {narration: 'x'}});
    expect(edit.script).toEqual(started.script);
  });

  it('ignores updates from an older job', () => {
    const state = run(approved(), {type: 'render/requested', preset: 'draft'}, {type: 'render/accepted', jobId: 'new', phase: 'queued', progress: 0});
    const stale = run(state, {type: 'render/progress', jobId: 'old', phase: 'done', progress: 1, videoUrl: 'http://x/old.mp4'});
    expect(stale.render.phase).toBe('queued');
    expect(stale.render.videoUrl).toBeUndefined();
  });

  it('never treats "done" without a file as success', () => {
    const state = run(approved(), {type: 'render/requested', preset: 'draft'}, {type: 'render/accepted', jobId: 'j', phase: 'rendering', progress: 0.9}, {type: 'render/progress', jobId: 'j', phase: 'done', progress: 1});
    expect(state.render.phase).toBe('failed');
    expect(hasDownloadableVideo(state)).toBe(false);
  });

  it('records failures with a message, and allows retry', () => {
    const failed = run(approved(), {type: 'render/requested', preset: 'final'}, {type: 'render/failed', error: 'Chrome not found'});
    expect(failed.render.phase).toBe('failed');
    expect(failed.render.error).toBe('Chrome not found');
    expect(deriveStatus(failed)).toBe('failed');
    expect(hasDownloadableVideo(failed)).toBe(false);
    expect(run(failed, {type: 'render/requested', preset: 'final'}).render.phase).toBe('submitting');
  });

  it('download is unavailable until a real file exists', () => {
    expect(hasDownloadableVideo(approved())).toBe(false);
    expect(hasDownloadableVideo(rendered())).toBe(true);
  });
});

describe('project actions', () => {
  it('restoring a draft never lands on a step its content does not allow', () => {
    const state = withScript();
    const restored = run(initialState(), {type: 'project/hydrate', state: {config: state.config, step: 'export', script: state.script, approval: null, render: state.render, sampleLoaded: true}});
    expect(restored.step).toBe('script');
  });

  it('reset and sample are refused while work is in flight', () => {
    const busy = run(readyForScript(), {type: 'script/requested'});
    expect(run(busy, {type: 'project/reset'}).busy.script).toBe(true);
    const fresh = run(readyForScript(), {type: 'project/reset'});
    expect(fresh.config.product.productName).toBe('');
    expect(fresh.sampleLoaded).toBe(false);
  });

  it('marks sample data as sample and never creates a script from it', () => {
    const state = readyForScript();
    expect(state.sampleLoaded).toBe(true);
    expect(state.script).toBeNull();
  });
});
