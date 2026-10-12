# Integration guide (frontend)

The UI never calls a provider directly. It talks to the interfaces in `src/services/types.ts`:

| Interface | Today | To connect your own |
| --- | --- | --- |
| `ScriptGenerationService` | `POST /api/plan` on this repo's API (Claude when `ANTHROPIC_API_KEY` is set). "Template draft" calls the same endpoint with `mock: true` and is labelled as not AI. | Implement `generate()` to return a `Storyboard` (shape in `packages/schema/src/storyboard.ts`). |
| `AssetService` | `POST /api/uploads` | Return an `UploadedAsset` with a URL the renderer can reach. |
| `VoiceoverService` | **Not connected.** Always reports unavailable. | Implement `synthesize()`; put `audioUrl` into `SceneJSON.audio.voiceoverUrl` and the timings into `SceneJSON.captions`. Narration text per scene is already collected in the script step. |
| `RenderService` | `POST /api/render`, `GET /api/render/:id` (Remotion on the API server). | Return `RenderJobStatus`. Only set `videoUrl` when a real file exists: the UI treats "done" without a URL as a failure. |
| `ProjectStore` | `GET/POST /api/projects` (JSON files). | Swap for your database-backed API. |

Wire a new provider in `src/workflow/WorkflowProvider.tsx` where `createLocalApiServices(connection)` is called.

## Rules the frontend relies on

- Every response is validated with Zod before the UI uses it. Invalid data becomes a `ServiceError` with kind `invalid-response`.
- `availability()` must be honest. The UI disables actions and explains how to enable them when a service is unavailable.
- Keep API keys on the server. `VITE_*` variables are visible to anyone who opens the site.

## Workflow states

`draft → validating (script in flight) → ready for review / awaiting approval → approved → generating (render) → completed | failed`

Approval and render validity are derived from content hashes (`approvalKeyOf`, `renderKeyOf` in `src/workflow/machine.ts`):

- Product details, storyboard, format (type, length, aspect ratio) or screenshots change → approval is void, and so is any render.
- Brand colors, fonts or animation change → approval stays, the rendered file is marked out of date and cannot be downloaded.
- Voice-over and caption preferences change → nothing is invalidated (they are not rendered yet).
