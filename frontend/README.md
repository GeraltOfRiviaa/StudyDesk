# StudyDesk frontend

See the [project README](../README.md) for Compose setup, authentication settings, Codespaces configuration, and production image builds.

From this directory, install locked dependencies with `npm ci`, run `npm run lint`, and run `node --test tests/*.test.js`. Set `STUDYDESK_TEST_CHROME` to an installed Chromium executable to include the local browser regression.

`npm run dev` defaults to the API at `http://localhost:8000`. Override it in `.env.local` when connecting to another host. `npm run build` requires an explicit `VITE_API_URL`.
