# StudyDesk — Agent instructions

## Project purpose
StudyDesk is a modular student workspace. The Library browses all items owned by the authenticated user. The Dashboard is a separate, configurable view of items through containers. Notes, files, events and forms are independent item types; tags categorize items and links connect them bidirectionally.

## Working rules
- Inspect the current repository before editing. Existing code and API contracts are the source of truth; these instructions describe intended architecture, not proof that every feature is implemented.
- Keep changes focused on the requested task. Avoid unrelated refactors, new dependencies and speculative abstractions.
- Prefer simple, readable code suitable for a student developer. Explain non-obvious decisions and tradeoffs.
- Preserve existing behavior and naming conventions. Ask before changing public API contracts, database schemas or authentication behavior.
- Do not commit, push, merge, delete user data or run seed scripts against an existing database without explicit permission.
- Never expose secrets or commit environment files containing credentials.

## Stack and development
- Frontend: React, Vite, Tailwind CSS, shadcn/ui, React Router and TanStack Query.
- Backend: FastAPI, Pydantic and asynchronous PyMongo.
- Database: MongoDB.
- Development uses Docker Compose Watch. Consult the README, Compose files, package.json and requirements.txt for actual commands and dependencies. Do not assume host paths match container paths.

## Frontend architecture
Follow the existing directory structure; typical responsibilities are:
- `api/`: authenticated HTTP client and feature-specific API functions.
- `hooks/`: reusable stateful logic, queries and mutations.
- `context/`: authentication and shared item modal state.
- `components/`: UI components grouped by feature; `components/ui/` contains shadcn primitives.
- `lib/`: shared configuration and utilities, including the QueryClient.
- Prefer existing shadcn components rather than implementing custom equivalents. Preserve the existing theme, responsive layout and accessibility.
- Keep UI components focused on rendering and interaction. Extract reusable data and mutation logic into hooks; do not over-split trivial components.
- Follow React's Rules of Hooks. Do not mutate state objects or Sets in place.

## Frontend data and state
- Use the existing API client with cookie credentials; do not introduce a second authentication mechanism.
- Use TanStack Query for server state and `useMutation` for new server mutations.
- Scope user-specific query keys to the authenticated user. Include filters and sorting in Library query keys.
- Invalidate relevant cached data after mutations, including Library results, item details, links and tag usage when affected. Inspect actual query keys and modal refresh mechanisms before implementing invalidation.
- Clear user-specific query data on logout. Pass cancellation signals to fetches where supported.
- Keep Library filters and sorting in URL search parameters; debounce title searching. Use cursor-based infinite queries, not offset pagination, for the Library.
- Preserve selection by both item type and ID. Use a Set for selection keys and create a new Set when changing state.
- Reuse the shared item modal context and renderer for opening items. Avoid duplicating modal management in rows.
- Handle loading, empty results, errors, pending mutations and duplicate submissions. Use existing toast conventions.

## Backend architecture
- `main.py`: application setup, middleware, router registration and existing application-level endpoints.
- `routers/`: HTTP endpoints, authentication dependencies and request/response handling.
- `models/`: Pydantic schemas and shared types.
- `core/`: reusable logic (search, collections, tags, links, bulk operations, security and rate limiting).
- `database.py`: shared asynchronous MongoDB connection.
- `seed.py`: development mock data; do not execute automatically.
- Keep reusable business logic in `core/`, not duplicated across routers. Core modules should not import routers.
- Reuse existing Pydantic types, validation and authentication dependencies. Use asynchronous database operations.

## Data model and security
- Item types are singular (`note`, `file`, `event`, `form`); collection names are plural (`notes`, `files`, `events`, `forms`). Tags are separate from linkable Library items.
- Reuse the centralized collection mapping in `core/collections.py` where present. Never accept arbitrary collection names from clients.
- Scope every user-owned read, update and delete to the authenticated user's ID. Validate ownership and existence of referenced items and tags.
- Use BSON ObjectId values in MongoDB queries and references; expose IDs using the existing API schema conventions.
- Preserve timezone-aware UTC timestamps. Update `updated_at` consistently when modifying items.
- Tags are user-owned references, not embedded tag objects. Respect existing tag limits and prevent duplicates.
- Links are bidirectional and stored separately. Match both endpoints by type and ID, prevent self-links and duplicate connections, and clean up associated links when deleting items.
- Prefer batch fetching and bulk database operations over per-item database queries. Preserve response contracts and ownership checks when optimizing.
- Do not claim multi-document operations are atomic unless transactions or equivalent guarantees are actually implemented.

## Library behavior
- The Library is a global browser, not a Dashboard container. Keep individual collection endpoints available for other features.
- Default view: all supported item types, sorted by `updated_at` descending, 30 items per page.
- Preserve lightweight table item responses and deterministic cursor sorting, including tie-breakers. Do not add unsupported sort fields.
- Empty type selection represents all types; selecting an empty collection alongside populated ones should not cause an error.
- Keep rows and actions generic across item types where practical. Do not implement future item types merely to satisfy an unrelated task.

## Bulk actions
- Delete: remove selected items using existing deletion behavior and associated link cleanup.
- Set tags: add tags to existing arrays without replacing them or introducing duplicates.
- Unlink tags: clear selected items' tag arrays without deleting tag documents.
- Remove links: delete all links involving selected items, without deleting either linked item.
- Existing intended endpoints: `POST /bulk/tags/add`, `POST /bulk/tags/remove`, `POST /bulk/links/remove`. Verify current schemas before calling them.
- Requests use selected `{type, id}` objects; adding tags also includes tag IDs. Respect backend batch limits (currently intended to be 100 items per request).
- Keep unsupported item actions unavailable in tag browsing mode. Confirm destructive actions and preserve existing bulk deletion behavior.
- If a multi-request operation partially succeeds, report that accurately and refresh affected data.

## Verification and handoff
- Inspect available scripts and run relevant lint, build and tests after changes when possible.
- For API changes, verify valid requests, invalid IDs, ownership isolation, empty results and relevant edge cases. For pagination, check tied sort values and mixed item types.
- For frontend changes, check existing search, filters, sorting, selection, modals, mutation feedback and cache refresh behavior as relevant.
- Do not claim tests passed if they were not run. Report environmental blockers and remaining risks.
- Finish with a concise summary, changed files, verification results and any assumptions or follow-up work. Explain significant implementation decisions so the maintainer can learn from the changes.
