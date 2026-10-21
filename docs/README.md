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

### Logs (in a second terminal)
```
docker compose -f docker-compose.dev.yml logs -f api
```

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
