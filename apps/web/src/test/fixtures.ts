/**
 * TEST FIXTURES ONLY. Never imported by application code.
 * The plan is the repo's example Claude-chat reply for the fictional "Flowly" sample.
 */
import planJson from '../../../../examples/flowly-plan.json';
import {storyboardSchema, type Storyboard} from '@ai-video-studio/schema';
import {sampleConfig} from '../domain/defaults';
import {fromStoryboard} from '../domain/mapping';
import type {ProjectConfig, Script} from '../domain/schemas';
import {createReducer, initialState, type WorkflowAction, type WorkflowState} from '../workflow/machine';

export const FONTS = ['Inter', 'Plus Jakarta Sans', 'DM Sans'] as const;
export const reducer = createReducer({fonts: FONTS});
export const run = (state: WorkflowState, ...actions: WorkflowAction[]): WorkflowState => actions.reduce(reducer, state);

export const samplePlan: Storyboard = storyboardSchema.parse(planJson);
export const sampleScript = (config: ProjectConfig = sampleConfig()): Script => fromStoryboard(structuredClone(samplePlan), 'claude-chat', config);

/** Sample inputs loaded (valid steps 1 and 2), no script. */
export const readyForScript = (): WorkflowState => run(initialState(), {type: 'project/sample'});

/** A valid, generated but not yet approved script. */
export const withScript = (): WorkflowState => {
  const state = run(readyForScript(), {type: 'script/requested'});
  return run(state, {type: 'script/received', script: sampleScript(state.config)});
};

export const approved = (): WorkflowState => run(withScript(), {type: 'script/approve'});
