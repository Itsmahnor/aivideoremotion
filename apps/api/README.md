# API package

Express API. Start it with `npm run dev:api` (from the repo root). It listens on http://localhost:4000.

- `POST /api/uploads` upload a screenshot or logo (png, jpg, webp, up to 5MB)
- `POST /api/plan` brand + brief in, storyboard + SceneJSON out (Claude, or the free mock planner)
- `POST /api/render` render a SceneJSON to MP4 with Remotion; `GET /api/render/:id` for progress
- `GET/POST/DELETE /api/projects` simple JSON-file projects in `storage/projects`

Copy `.env.example` to `.env`. Set `MOCK_AI=1` to use the app without an Anthropic key.
Skills live in `src/skills`. The playground (`npm run playground -w @ai-video-studio/api -- inputs/<file>.json`) tests plans from the command line.
