# Schema package

Shared Zod schemas and inferred TypeScript types for every application and video composition.

`src/storyboard.ts` holds the storyboard rules (scene counts, first/last scene, template limits) and the deterministic storyboard → SceneJSON compiler. The API planner and the web editor both use it, so a storyboard that passes in the browser passes on the server.
