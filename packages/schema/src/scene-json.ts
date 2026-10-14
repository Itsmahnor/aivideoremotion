import {z} from 'zod';

/** Transition kinds the renderer knows. 'none' is only valid for the last scene. */
export const TRANSITION_TYPES = ['fade', 'slide', 'wipe', 'flip', 'clockWipe'] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const transitionOutSchema = z
  .object({
    type: z.enum([...TRANSITION_TYPES, 'none']),
    durationInFrames: z.number().int().nonnegative(),
  })
  .superRefine(({durationInFrames, type}, context) => {
    if (type === 'none' && durationInFrames !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'durationInFrames must be 0 when transition type is "none"',
        path: ['durationInFrames'],
      });
    }
  });

export const sceneSchema = z.object({
  id: z.string().min(1),
  template: z.string().min(1),
  durationInFrames: z.number().int().positive(),
  props: z.record(z.string(), z.unknown()),
  transitionOut: transitionOutSchema.default({type: 'none', durationInFrames: 0}),
});

export const captionSchema = z
  .object({
    text: z.string().min(1),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
  })
  .refine(({endMs, startMs}) => endMs > startMs, 'endMs must be after startMs');

/**
 * Audio. Every field is optional on purpose: nothing plays unless a URL is given,
 * so a missing sound file can never break a render by default.
 * URLs are absolute, or paths inside packages/video/public (e.g. "audio/music/calm.mp3").
 */
export const audioSchema = z.object({
  voiceoverUrl: z.string().min(1).optional(),
  musicUrl: z.string().min(1).optional(),
  /** Music volume 0..1 (default 0.25 in the renderer). */
  musicVolume: z.number().min(0).max(1).optional(),
  /** Music level while a voice-over or caption is active, as a multiple of musicVolume (default 0.35). */
  duckTo: z.number().min(0).max(1).optional(),
  /** Short sound effects. Each one plays only if its URL is set. */
  sfx: z
    .object({
      transitionUrl: z.string().min(1).optional(),
      entranceUrl: z.string().min(1).optional(),
      volume: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export const sceneJsonSchema = z
  .object({
    version: z.literal(1),
    meta: z.object({
      fps: z.number().int().positive(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    scenes: z.array(sceneSchema).min(1),
    audio: audioSchema.default({}),
    captions: z.array(captionSchema).default([]),
  })
  .superRefine(({scenes}, context) => {
    const sceneIds = new Set<string>();

    scenes.forEach((scene, index) => {
      if (sceneIds.has(scene.id)) {
        context.addIssue({
          code: 'custom',
          message: `Scene id "${scene.id}" must be unique`,
          path: ['scenes', index, 'id'],
        });
      }
      sceneIds.add(scene.id);

      const transitionDuration = scene.transitionOut.durationInFrames;
      if (transitionDuration >= scene.durationInFrames) {
        context.addIssue({
          code: 'custom',
          message: 'transitionOut.durationInFrames must be smaller than its scene durationInFrames',
          path: ['scenes', index, 'transitionOut', 'durationInFrames'],
        });
      }

      const nextScene = scenes[index + 1];
      if (nextScene && transitionDuration >= nextScene.durationInFrames) {
        context.addIssue({
          code: 'custom',
          message: 'transitionOut.durationInFrames must be smaller than the next scene durationInFrames',
          path: ['scenes', index, 'transitionOut', 'durationInFrames'],
        });
      }

      if (!nextScene && scene.transitionOut.type !== 'none') {
        context.addIssue({
          code: 'custom',
          message: 'The last scene transitionOut type must be "none"',
          path: ['scenes', index, 'transitionOut', 'type'],
        });
      }
    });
  });

export type SceneJSON = z.infer<typeof sceneJsonSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneAudio = z.infer<typeof audioSchema>;
export type TemplateSchemaRegistry = Record<string, z.ZodType>;

export const getTotalDurationInFrames = (sceneJson: SceneJSON): number =>
  sceneJson.scenes.reduce(
    (total, scene) => total + scene.durationInFrames - scene.transitionOut.durationInFrames,
    0,
  );

export const createSceneJsonSchema = (templateSchemas: TemplateSchemaRegistry) =>
  sceneJsonSchema.superRefine(({scenes}, context) => {
    scenes.forEach((scene, index) => {
      const propsSchema = templateSchemas[scene.template];
      if (!propsSchema) {
        context.addIssue({
          code: 'custom',
          message: `No props schema registered for template "${scene.template}"`,
          path: ['scenes', index, 'template'],
        });
        return;
      }

      const result = propsSchema.safeParse(scene.props);
      if (!result.success) {
        context.addIssue({
          code: 'custom',
          message: `Invalid props for template "${scene.template}": ${result.error.issues
            .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
            .join(', ')}`,
          path: ['scenes', index, 'props'],
        });
      }
    });
  });