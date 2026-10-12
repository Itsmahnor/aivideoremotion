# Repository Guidelines

## Stack

- TypeScript with strict mode enabled
- React + Vite for the web application
- Express + MongoDB for the API
- Remotion for video
- Zod for schemas
- npm workspaces for package management

## Remotion

- Rendering must be deterministic. Never use `Math.random`, `Date.now`, `setTimeout`, CSS transitions, or CSS animations.
- Drive every animation with `useCurrentFrame`, `interpolate()`, and `spring()`.
- Use `Sequence` or `TransitionSeries` for timing.
- Use `Img` and `Audio` from `remotion`, `staticFile` for assets, and `@remotion/google-fonts` for fonts.
- Pin every `remotion` and `@remotion/*` dependency to the same exact version.
- Never hard-code colors or fonts in scenes; read them from brand-theme tokens.
- Every scene template must have a Zod props schema and be registered in the central registry.

## Project hygiene

- Keep files small and fully typed.
- Add a short README note to each package.

## Product

- This tool turns a Brand Kit + user selections + a prompt + optional uploaded screenshots into a SaaS explainer video.
- The AI outputs SceneJSON that references registered templates. It never writes code.
- `packages/schema/src/templates.ts` is the template contract: props, limits and `.describe()` text live there and nowhere else. Scene components import their prop types from it.
- All images go through `resolveAsset()`. A scene with a missing image falls back to `MockUI`.
- Every template prop has a Zod `.describe()` and a length limit. The AI reads them.
- SceneJSON is the source of truth and is never flattened.
- There is no voiceover: on-screen text must carry the story.
- Skills live in `apps/api/src/skills`. Fix bad AI output by editing a skill or a template's `whenToUse`, not by hard-coding.
