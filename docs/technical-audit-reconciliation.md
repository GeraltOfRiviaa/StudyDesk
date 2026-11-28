# StudyDesk technical audit reconciliation

This report covers the finding IDs assigned to Checkpoints 1–6. It records implementation evidence separately from checks that need a deployed environment. Checkpoints 1–5 were manually verified before Checkpoint 6, and their retained regressions were rerun.

| Checkpoint | Finding | Status | Implementation and verification evidence |
| --- | --- | --- | --- |
| 1 | C-01 · JWT signing secret | Resolved | Startup requires a securely generated secret. Signing and verification share that configuration. Token tests cover algorithm restrictions, missing expiry, malformed tokens, and expiration. |
| 1 | H-06 · Unfinished Google authentication exposed | Resolved | The Google login and callback routes remain unregistered. The auth suite checks that they are unavailable and that password sign-in continues to work. Completing Google sign-in is intentionally deferred. |
| 1 | M-01 · Password validation and authentication protections | Resolved | Password validation enforces bcrypt's UTF-8 byte limit, and bcrypt work runs off the async event loop. Regressions cover bounded rate limits, trusted forwarded addresses, secure cookie settings, browser write origins, and CORS headers on rejected requests. |
| 2 | H-01 · Invalid PATCH values | Resolved | Update models distinguish omitted fields from explicit nulls and share creation limits. Regressions cover rejected nulls and accepted requests that clear tags or content. |
| 2 | H-02 · Tag deletion and reference integrity | Resolved | The per-user write lock coordinates reference assignment and deletion. Tag references are cleaned up before the tag is deleted. Tests inject cleanup failures and verify that retries recalculate usage. |
| 2 | H-04 · Link canonicalization | Resolved | Link creation normalizes IDs, rejects self-links, and canonicalizes typed endpoints. Tests cover reversed duplicates and races with deletion. The known pre-existing dangling link remains an unresolved repair item. |
| 2 | H-05 · Concurrent tag assignment | Resolved | Validation, limit checks, and writes share the per-user lock. MongoDB tests cover concurrent assignments near the 100-tag limit and normalization of equivalent IDs. |
| 2 | M-03 · Partial bulk operation failures | Resolved | The API reports acknowledged changes separately from completed targets. The UI retries unfinished targets and refreshes affected cache entries. Tests cover successful no-ops, partial progress, and uncertain write outcomes. |
| 3 | H-03 · Missing database indexes and uniqueness | Resolved | The 17 baseline indexes cover owner reads, recent ordering, tags, typed link adjacency, and uniqueness where required. Tests cover lowercase email identity, case-sensitive usernames, concurrent uniqueness conflicts, and intentionally repeated tag names. |
| 3 | M-06 · Index initialization and existing-data checks | Resolved | FastAPI lifespan initializes missing indexes and fails on conflicts with an actionable error. Tests verify fresh startup, repeat startup, and preservation of existing index definitions. Production data checks are performed through the documented read-only deployment preflight. |
| 4 | M-02 · Cursor validation and query consistency | Resolved | Typed cursors bind to effective sorting and filter context. Tests cover both directions, ties across collections, normalized tag matching, owner boundaries, and recovery after a rejected continuation. Optimized owner/date branches retain the final global sort and are tested against the reference results. |
| 5 | M-04 · Tag pickers limited to the first page | Resolved | Both pickers use cancellable server-side search and page through results. Browser tests exercise duplicate-name selection by ID, pinned selections, and tags created independently of the parent modal. Library metadata lookup uses bounded batches. |
| 5 | M-05 · Authentication and modal lifecycle | Resolved | Session-scoped modals and operations retire on account changes. Protected 401s share session verification and preserve the original API failure. Tests exercise late requests, confirmed expiration, transient failures, and account switching. |
| 6 | M-07 · Build and deployment configuration | Resolved | Compose passes an optional frontend environment at runtime, and Vite has a local fallback. The production build requires a public API base. Nginx tests cover direct HTML navigation, missing assets, and API-shaped requests. See environment coverage below. |
| 6 | L-01 · React lint configuration | Resolved | The React plugin is registered and the complete lint suite passes with the checked-in rules. The browser test also exercises the session-keyed modal provider after its move. |
| 6 | L-02 · API consistency | Resolved | Notes keeps its array response and exposes pagination headers. Note creation and link routes have response models matching the existing payloads. Tag lookup accepts the frontend's full 100-ID batch, with retained tests for bounds and owner isolation. |
| 6 | L-03 · Unused dependencies and artifacts | Resolved | Removed unused imports and inactive UI demos, deduplicated filter serialization, and removed tracked bytecode. Dependency removals were checked against imports and the installed Python dependency graph, including deferred Google code. Fresh frontend and API images built successfully. |
| 6 | L-04 · Outdated documentation | Resolved | Setup, API behavior, schema, and workflows distinguish implemented functionality from planned features and draft validators. Duplicate tag names and regex-based search are documented. |

## Remaining items

- **Unresolved** · The previously identified dangling link requires a separately approved data repair. Checkpoint 6 used disposable databases and made no change to that record.
- **Intentionally deferred** · Google sign-in, Files, Events, Forms, Dashboard containers, physical file cleanup, Form Response deletion workflows, and specialized calendar indexes.
- **Intentionally deferred** · Server-side JWT revocation and cross-process locking. A copied JWT can be valid until expiry, and per-user write locks and rate counters coordinate a single API process.
- Case-insensitive substring regex can scan owner-scoped candidates. Cursor traversal assumes an unchanged dataset for stable membership across pages. MongoDB Search was removed from the design.

## Dependency changes

- Frontend · `github-markdown-css`.
- Backend · `Authlib`, `cffi`, `charset-normalizer`, `cryptography`, `google-api-core`, `google-api-python-client`, `google-auth`, `google-auth-httplib2`, `google-auth-oauthlib`, `googleapis-common-protos`, `httplib2`, `joserfc`, `oauthlib`, `passlib`, `proto-plus`, `protobuf`, `pyasn1`, `pyasn1_modules`, `pycparser`, `pydantic-settings`, `pyparsing`, `requests`, `requests-oauthlib`, `uritemplate`, and `urllib3`. The deferred Google handlers still import `httpx`, which is retained and also used by the API tests.

## Environment coverage

The final run passed 42 backend regressions against disposable MongoDB and 24 frontend regressions including Chrome. Full ESLint and `git diff --check` passed. Clean Python and Node dependencies installed in Docker, and `pip check` found no broken requirements.

An isolated Compose project verified the local Vite fallback, API startup, registration, cookie login, authenticated reads, and logout. Recreating the frontend service with a Codespaces-style environment file confirmed that Vite received the HTTPS API URL and accepted the configured forwarded host.

The production image built with `VITE_API_URL=/api` and failed with the documented configuration error when the value was omitted. A fresh Nginx container returned 200 for direct routes and a built asset, and 404 for missing assets and misrouted API requests. The frontend install reported two moderate npm advisories, and the build reported a chunk-size warning.

Live GitHub Codespaces port forwarding and a deployed production ingress require those environments. The deployment instructions document both configurations.
