# Web package

Vite + React frontend: a guided, five-step SaaS explainer video builder.

1. **Product** – name, descriptions, problem, features, benefits, audience, objective, call to action.
2. **Customize** – any brand colors (picker, HEX, RGB) with contrast warnings, gradient, logo, format, length, visual style, fonts, animation, screenshots, voice-over/caption preferences.
3. **Script** – generate (Claude API, Claude chat copy/paste, or a clearly labelled rule-based template draft), edit every scene, reorder, approve.
4. **Generate** – live in-browser preview of the approved storyboard, scene thumbnails, MP4 render with status, errors and retry.
5. **Export** – plays the rendered file; download stays disabled until a real file exists.

Start it with `npm run dev:web` (opens http://localhost:5173). Features that need a server (AI script, uploads, rendering) use the API in `apps/api` (`npm run dev:api`) and show a "not connected" state when it is not running. Set `VITE_API_URL` to point at another server. Never put secrets in `VITE_` variables.

## Layout

| Folder | What lives there |
| --- | --- |
| `src/domain` | Types (Zod schemas), defaults, validation, colors, mapping to the shared Brief/BrandKit. Pure, no React. |
| `src/workflow` | State machine (`machine.ts`), browser persistence, React provider that runs async work. |
| `src/services` | Integration contracts (`types.ts`) and the provider for this repo's API (`localApi.ts`). |
| `src/components` | Design-system pieces, dialogs, color field, previews, scene editor. |
| `src/steps` | One component per step. |
| `src/test` | Test-only fixtures (sample data never used by the app flow). |

Storyboard rules (scene counts, first/last scene, template limits) come from `@ai-video-studio/schema` (`storyboard.ts`), the same code the API planner uses.

## Integrating real services

See `INTEGRATION.md` in this folder.

## Commands

`npm run typecheck -w @ai-video-studio/web`, `npm test -w @ai-video-studio/web`, `npm run build -w @ai-video-studio/web`.
