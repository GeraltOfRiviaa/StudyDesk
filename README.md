# StudyDesk

## Running the project (dev, Docker Compose Watch)

### Prerequisites
- Docker Desktop (running)
- Python 3.12+ (only for editor support and generating the JWT secret)

### First-time setup
1. Clone the repo.
2. Create the env files from the examples:
```
   cp .env.example .env.local
   cp frontend/.env.example frontend/.env.local
```
3. Generate a JWT secret and paste it into `.env.local`:
```
   python -c "import secrets; print(secrets.token_hex(32))"
```
   Use the generator for every new secret and keep the generated value private. The API requires 64 hexadecimal characters and rejects common weak patterns. These checks cannot establish randomness.
   Replacing `JWT_SECRET` invalidates all previously issued sessions. Recreate the Compose API container after changing `.env.local` so it reads the new value. Users will need to sign in again.
4. (Optional, for editor autocomplete) create a local venv:
```
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
```

### Start
```
docker compose -f docker-compose.dev.yml watch
```
This builds, starts all services and keeps running in the terminal (stop it with `Ctrl+C`).

Watch handles changes automatically:
- Edits in `backend/` and `frontend/` are synced into the containers (uvicorn `--reload` and Vite HMR do the live reload).
- Changes to `backend/requirements.txt` or `frontend/package.json` trigger an automatic rebuild.
- After changing a Dockerfile or the compose file, stop and run the command again with `up --build --watch` once.

### Stop
```
docker compose -f docker-compose.dev.yml down
```
Data is kept in the `studydesk` volume. Use `down -v` to delete it.

### Services
| Service  | URL                                    |
|----------|----------------------------------------|
| Frontend | http://localhost:5173                  |
| API      | http://localhost:8000                  |
| API docs | http://localhost:8000/docs             |
| Health   | http://localhost:8000/health           |
| MongoDB  | `mongodb://localhost:27018` (Compass)  |

### Authentication settings

| Setting | Local Compose value | HTTPS and Codespaces |
|---|---|---|
| `JWT_SECRET` | Generate it with the command above | Generate a separate secret for each deployment |
| `FRONTEND_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Set the exact public frontend origin, including its scheme and any non-default port. Separate multiple origins with commas |
| `AUTH_COOKIE_SECURE` | `false` | Set `true` |
| `FORWARDED_ALLOW_IPS` | Empty | Leave empty for direct connections. Set explicit trusted ingress IPs or networks when the API is behind a proxy that sanitizes forwarded headers |
| `VITE_API_URL` in `frontend/.env.local` | `http://localhost:8000` | Set the HTTPS API URL. For Codespaces, use the forwarded API URL and allow the forwarded frontend origin |

Use matching hostnames for the local frontend and API. For example, open the frontend at `http://localhost:5173` when `VITE_API_URL` uses `localhost`. Keep the frontend and API on the same site from the browser’s point of view because the cookie uses `SameSite=Lax`. On Codespaces, use the port URLs shown in the **Ports** panel. For deployments on unrelated sites, use an HTTPS same-origin proxy for the API.

The API checks the browser origin on write requests, including password login and logout. For direct clients that send neither `Origin` nor `Referer`, add `X-StudyDesk-Request: 1` to `POST`, `PUT`, `PATCH` and `DELETE` requests. When using the local Swagger UI to send requests, add its origin, such as `http://localhost:8000`, to `FRONTEND_ORIGINS`. FastAPI expects form data for login and JSON for registration, password changes and account deletion.

```text
curl.exe -X POST -H "X-StudyDesk-Request: 1" http://localhost:8000/auth/logout
```

Login permits 10 attempts per minute per IP, and registration permits 5 per 10 minutes per IP. Password changes and account deletion each permit 5 attempts per 5 minutes per account. The API returns `429` and `Retry-After` in seconds. Clients sharing an IP share a bucket, and the counters reset when the single API process restarts. The container ignores forwarded addresses by default. For a direct host launch outside Docker, use `uvicorn main:app --no-proxy-headers`.

Passwords created through registration or password change must have at least eight characters and fit within bcrypt’s 72-byte UTF-8 limit. Google sign-in is postponed. The seven-day JWT is carried in an HTTP-only cookie. Logout clears the browser cookie. A copied token can still be valid until it expires, including after a password change. Deleting the account invalidates its tokens because authenticated requests check that the account exists.

### Authentication regression tests

From `backend`, with `requirements.txt` installed, run:

```text
python -m unittest discover -s tests -v
```

The tests use isolated in-memory records and exercise the API middleware, so they do not require a running MongoDB or seeded account.

### Data integrity and retries

Routes that coordinate item, tag, link and account writes acquire the per-user lock once through `get_account_writer`. The lock covers ownership checks, preflight and writes. Core helpers called by those routes must not acquire the same lock again. Waiting and active requests keep the lock alive, and its weak registry entry expires when the last request releases its reference.

The lock coordinates one API process. Standalone MongoDB cannot roll back work across documents or collections. A bulk 503 reports completed `{type, id}` targets separately from acknowledged modification or deletion counts. Retry the unresolved targets. A timed-out or canceled database command can still have an unknown outcome. Tag deletion retries recheck ownership and usage, then continue removing any remaining references before deleting the tag.

Run the backend regression suite with the command above. To include database operator tests, set `STUDYDESK_INTEGRITY_MONGO_PORT` to the published loopback port of a disposable MongoDB instance. The tests create and remove their own database on that instance. From `frontend`, run `node --test tests/bulkApi.test.js` to check client batching and partial progress.

### Logs (in a second terminal)
```
docker compose -f docker-compose.dev.yml logs -f api

```

### Seeding 

**Seed**
```
docker compose -f docker-compose.dev.yml exec api python seed.py --dev
```
**Reset**
```
docker compose -f docker-compose.dev.yml exec api python seed.py --dev --reset
```
**Clear the demo account**
```
docker compose -f docker-compose.dev.yml exec api python seed.py --dev --clear
```
**Demo account credentials**
```
Username: studydesk-demo
Password: StudyDeskDemo123!
```

### Shadcn preset code
b2C8Rr6hs

## Update

> [!NOTE]
> **Where to look:**  and `progress.md` in the [docs](/docs) folder.



## Problem
Students use too many disconnected tools (Notion, Google Disk , Google Calendar/ Notion Calendar, RemNote, AnkiCards). They need **one place** to plan, study, and track progress — with items that can **talk to each other**.

##  Solution
A **modular dashboard web app** where students add different containers of one item type(Note, Archive, Calendar, Form). Containers are standardized in size but customizable, and **can connect** to show related data by tags or relations.

---

## Core Concept
-  Dashboard with draggable, resizable, filterable containers
-  Each container is a reusable component  
- Items are connected via links which work as a shortcut to related items
- Tags connect broader themes but can separate items into niche domains

---

## Visual Example (not final design)
> [!NOTE]
> Everything was done by hand with the use of [shadcn/create Figma community kit](https://www.figma.com/community/file/1342715840824755935/shadcn-ui-components-with-variables-tailwind-classes-updated-september-2026).

<img width="597" height="1280" alt="TabletFinishedTest" src="https://github.com/user-attachments/assets/65bdbba9-f4f6-4eda-9e43-f5a9d2ead8e9" />
<img width="798" height="1284" alt="TableTest" src="https://github.com/user-attachments/assets/544a262d-23ec-484f-8150-d1131d15578e" />
<img width="1799" height="1279" alt="PCDashboard" src="https://github.com/user-attachments/assets/3e4881d8-327f-4fcf-afe2-f5a76f9f30f4" />
<img width="596" height="1284" alt="MobileWidgetTypes" src="https://github.com/user-attachments/assets/eba6fc33-89ad-433d-ab66-507833f86340" />
<img width="366" height="1281" alt="MobileDashboard" src="https://github.com/user-attachments/assets/45e8a303-4d0c-47d8-8336-3fbe3252c54b" />
<img width="588" height="1284" alt="CreatingContainer" src="https://github.com/user-attachments/assets/a67ea237-2cb8-4a6a-9998-b4185db83a2e" />

# Items 


##  Note
Notes are markdown documents editable directly in the app
## Archive
Archive is the file manager widget for storing files and connecting them to notes. Supported files will be JPEG, PNG, PDF for now
## Calendar
Basic calendar where you can create events as in Google Calendar with the ability to repeat events and adding reminders ahead of time.
## Form
Forms with multiple types of questions to quiz yourself on your knowledge.

# Containers
Every item (Note, Archive, Calendar, Form) is backed by a Container — the part that holds items and lives on the dashboard. The actual data (Note, Archive Item, Event, Form) is stored separately. Every item is has its own ID stored in the container and items are then fetched separately when creating or displaying containers. View is fixed at creation and never changes.

---
# Views
Containers can have one of 3 views and every item can be viewed with them(catalogue, table, single). Events are the exception, they can be viewed in a normal calendar view or with a single view, other views are not supported.  The view can be changed when on dashboard. **You cannot change the type of items a container displays after creation of the container**.  

---

# Technical Decisions
> [!IMPORTANT]
> These are current decisions, not final ones — several are still open questions (see progress.md).
- **One active account per session** (multi‑account switching can be added later)
- **File uploads stored by the app** (with size limits in v1)
- **Note content is markdown editable in app**
- **Archive files can be linked to anything**
- **Calendar supports calendar and single views** 
- **Note, Archive, and Form support table, catalogue and single view**
- **Container type is set at creation and immutable**

---

#  Tech Stack

React + Tailwind  
        ↓  
FastAPI  
        ↓  
Pydantic  
        ↓  
MongoDB

---

# Input Validation
Input should be validated before and storing to database via API and MongoDB.

## General Validation Strategies
- **Schema validation**: strict schemas for each request body; reject unknown fields.
- **Regex validation**: enforce formats (email, HEX colors, filenames, allowed tag characters).
- **Length limits**: cap title/tag/description/prompt sizes before insert.
- **Enum/lookup validation**: verify type/status exists and is active.
- **Cross‑field rules**: end date after start date, positive time limits, score in range.
- **File checks**: MIME allowlist, size limits, filename sanitization, store with safe server‑side name.
- **HTML/JS sanitization**: strip scripts from any user‑generated text rendered in UI, leave only Markdown formatting .
- **Rate limiting**: block abuse on uploads or repeated requests.

These checks keep invalid or malicious data out of the system even before the database layer.

---
#  Database and API
The application utilizes a non-relational database structure managed via MongoDB and accessed via FastAPI. To maintain high performance and prevent data synchronization issues, collections are strictly decoupled—containers only store UI layouts and filter strings, while cross-widget relationships are isolated in a dedicated links collection.

<img width="3408" height="4848" alt="Database" src="https://github.com/user-attachments/assets/db802f8e-6700-4cad-b530-e2a698e90615" />
<img width="1626" height="2589" alt="Indexes" src="https://github.com/user-attachments/assets/d49cf1cf-a75f-4f37-9266-b25129b18dee" />




# Student Dashboard – Data Model




Samuel Svoboda IT3 SŠPU
