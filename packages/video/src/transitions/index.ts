import type {TransitionPresentation} from '@remotion/transitions';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {fade} from '@remotion/transitions/fade';
import {flip} from '@remotion/transitions/flip';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import type {Scene} from '@ai-video-studio/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPresentation = TransitionPresentation<any>;

/**
 * One place that maps a SceneJSON transition name to a Remotion presentation.
 * To add an effect: add its name to TRANSITION_TYPES (packages/schema/src/scene-json.ts) and a case here.
 * clockWipe needs the video size.
 */
export const presentationFor = (type: Scene['transitionOut']['type'], size: {width: number; height: number}): AnyPresentation | null => {
  switch (type) {
    case 'fade':
      return fade();
    case 'slide':
      return slide({direction: 'from-right'});
    case 'wipe':
      return wipe({direction: 'from-left'});
    case 'flip':
      return flip({direction: 'from-right'});
    case 'clockWipe':
      return clockWipe({width: size.width, height: size.height});
    default:
      return null;
  }
};