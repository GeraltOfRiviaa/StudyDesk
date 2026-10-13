# 🎓 StudyDesk

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
> **Where to look:** `citations.md` and `progress.md` in the [docs](/docs) folder.


## Story Time
> [!TIP]
> This section is a personal backstory on why the project exists. Skip to [Problem](#-problem) for the short version.

As a student who always tried to enhance my study habits I always looked at the internet for the ✨**perfect**✨ study app. For some time I was okay with having simply my handwritten notes in my drawer and testing myself by hiding the words with my hand. I was doing this till I felt prepared for the test ahead. It's nice and simple, but with age came more work. Harder and longer assignments, tests and I needed to *upgrade*. I came upon [RemNote](https://www.remnote.com/). 

> Great app not only for testing yourself but also for storing, categorizing and managing knowledge. 

But then I needed some way to remind myself of tests on certain dates and I also wanted to keep track of what I have to do for school, what chores I had to do, what project tasks I needed done etc. So now I had **Google Calendar** and [Habitica](https://habitica.com/). As I went to study IT I became more interested in enhancing my studying ability's. I wanted to automate everything and I was switching from the holy trinity. It became annoying trying to connect everything into the perfect ecosystem and then still missing the mark in the end. I came close with [Notion](https://www.notion.com/) but there was still something bugging me about it.

> It was so much work to get my ideal digital study space. [Notion](https://www.notion.com/) had a lot of freedom but also so much limitations. It allowed me to do great things when I dig deep. But then I looked back and saw how much time I had to spend just organizing and thinking of my dashboard while making it pretty at the same time. Notion just missed the mark but was so close. 

Now while I was thinking about a final project for my school I was lost. Then my teacher gave me an idea of an app that would be the hub of tools for a student. 

>Everything a student needs in one place, one page. Simple, easy to use but handy tools that would make students life just that much easier.

Thats how I thought of 🎉***Students Dashboard***🎉

A web app, that would have the essential tools not only for studying but also for organizing yourself, your work and schedule, tasks and even visualizing your progress in graphs and others stats to keep track of your progress and keep you motivated! The goal is to have everything in one place and connected together. If you make yourself a test, take it a few times then you can add a stats widget and visualize your result to see how you're doing. You have a file you're studying from and don't remember the exact name? Look at the file manager, filter files by tag and then add the one important note onto the dashboard to avoid this petty process again!

The power of this app is that anything you want can be seen right there in one page and you can get anywhere with minimal effort while also making your study space pretty. You have the freedom of not only choosing what things you want to see but also how they should be shown. 

## 🌍 Problem
Students use too many disconnected tools (notes, files, calendars, forms). They need **one place** to plan, study, and track progress — with widgets that can **talk to each other**.

## ✅ Solution
A **modular dashboard web app** where students add predefined widgets (Note, Archive, Calendar, Form). Widgets are standardized in size but customizable, and **can connect** to show related data by tags or relations.

---

## ✨ Core Concept
- 🧩 Dashboard with draggable, resizable widgets  
- 🧱 Each widget is a reusable component  

- 👤 User accounts keep personal dashboards and data  

---

## Visual Example (not final design)
> [!NOTE]
> Everything was done by hand with the use of [shadcn/create Figma community kit](https://www.figma.com/community/file/1342715840824755935/shadcn-ui-components-with-variables-tailwind-classes-updated-september-2026).


<img width="1544" height="1019" alt="Snímek obrazovky 2026-10-06 214552" src="https://github.com/user-attachments/assets/d78c852b-6c93-4948-a190-2a72d95b7063" />


---

<img width="1450" height="1205" alt="Snímek obrazovky 2026-10-06 214524" src="https://github.com/user-attachments/assets/0336aa4c-e6d9-41c8-874a-5109f38ec8a8" />

---

<img width="1411" height="1007" alt="Snímek obrazovky 2026-10-06 214459" src="https://github.com/user-attachments/assets/f8ed3c02-8ba8-4f5d-8516-da6216e9fca2" />

---

<img width="1377" height="1163" alt="Snímek obrazovky 2026-10-06 214451" src="https://github.com/user-attachments/assets/3e329695-6ed4-4c58-a140-8a8ff5681837" />


---

<img width="1714" height="1199" alt="Snímek obrazovky 2026-10-06 214440" src="https://github.com/user-attachments/assets/43b0d886-3cd9-4f41-a622-491446eb7330" />


---
# 🧩 Widgets (Detailed Spec)
All widgets support changing view and filtering by tag — see Default Actions and Filters basics in progress.md. Actions below only list what's unique to each widget.

## 📝 Note
### Summary
Notes are plaintext/markdown documents editable directly in the app. The Note widget can be used as a single note view, catalog view, or table view.

### Actions
- Write markdown text with pictures, links, and basic formatting
- Link forms and events in metadata section
- Attach/select files from Archive

### Data Stored
- Title
- Markdown content
- Tags
- Linked archive file IDs
- Container ID
- Created at / Updated at
- User ID

---

## 🗂️ Archive
### Summary
Archive is the file manager widget for storing files and connecting them to notes. Supported files will be JPEG, PNG, PDF for now

### Actions
- Upload/download files
- Link/unlink files to notes

### Data Stored
- Filename
- File reference (storage path / MIME type / size)
- Tags
- Linked note IDs
- Container ID
- Created at / Updated at
- User ID

---

## 🗓️ Calendar
### Summary
Calendar is a widget in which you can display events. Events serve as glorified reminders, which funnely enough can have reminders ahead of time, so you don't forget about them. Their speciality is that they support links to notes, forms and files in the archive. Imagine you put a single view event on a dashboard; few days later you open the app and instead of searching for related tests and notes manualy you just open the event and go straight to the material.

### Actions
- Open and edit event details
- Set reminders ahead of time
- Link notes, forms, and files to an event

### Data Stored
- Title
- Start / End time
- Description
- Tags
- Reminders
- Linked note/form/files IDs
- Container ID
- Created at / Updated at
- User ID

---
## 🧪 Form
### Summary
Form provides self-testing (quiz/test forms) and structured data-collection forms, with support for table and catalog presentation modes.

### Actions
- Fill/submit a form and view result/history
- Link to related notes/calendar events

### Data Stored
- Title
- Form fields/questions
- Responses
- Results history
- Tags
- Linked note/calendar IDs
- Container ID
- Created at / Updated at
- User ID

---

# ⚙️ Backend Structures
**Container**

Every widget (Note, Archive, Calendar, Form) is backed by a Container — the part that holds items and lives on the dashboard. The actual data (Note, Archive Item, Event, Form) is stored separately and linked back via Container ID. Type is fixed at creation and never changes.


### Data Stored
- Type (note / archive / calendar / form)
- Title
- Created At
- User ID
> [!WARNING]
> Container type is fixed at creation and cannot be changed afterward. Plan container creation accordingly.

---

# 🔗 Shared Concepts
**Tags**
- Used for filtering and linking  
- Created by users  

**Relations**
- Notes ↔ Archive files  
- Notes ↔ Calendar events  
- Notes ↔ Forms  
- Forms ↔ Calendar events  

---

# ⚙️ Technical Decisions (Current)
> [!IMPORTANT]
> These are current decisions, not final ones — several are still open questions (see progress.md).
- **One active account per session** (multi‑account switching can be added later)
- **File uploads stored by the app** (with size limits in v1)
- **Note content is plaintext/markdown editable in app**
- **Archive files can be linked to notes**
- **Calendar supports month/day/event views**
- **Note and Form support catalog modes**
- **Note, Archive, and Form support table view**
- **Container type is set at creation and immutable**

---

# 🧰 Tech Stack
React + Tailwind  
        ↓  
FastAPI  
        ↓  
Pydantic  
        ↓  
MongoDB

---

# 🔒 Input Validation
Input should be validated before processing and persistence.

## ✅ General Validation Strategies
- **Schema validation**: strict schemas for each request body; reject unknown fields.
- **Regex validation**: enforce formats (email, HEX colors, filenames, allowed tag characters).
- **Length limits**: cap title/tag/description/prompt sizes before insert.
- **Enum/lookup validation**: verify type/status exists and is active.
- **Cross‑field rules**: end date after start date, positive time limits, score in range.
- **File checks**: MIME allowlist, size limits, filename sanitization, store with safe server‑side name.
- **HTML/JS sanitization**: strip scripts from any user‑generated text rendered in UI.
- **Rate limiting**: block abuse on uploads or repeated requests.

These checks keep invalid or malicious data out of the system even before the database layer.

---
# 📖 Database and API

Database of my choice is MongoDB because of its non-relational database schema. To access said database I'll use FastAPI for its automatic docs documentation and ease of use.

## Endpoints

To gather information about widgets, update or delete them these endpoints will be used.

### 👤 Users


- `POST /users` — create user
- `GET /users/{user_id}` — get user
- `PATCH /users/{user_id}` — update user
- `DELETE /users/{user_id}` — delete user
- `POST /auth/login` — login

---

### ⚙️ Containers


- `POST /containers` — create container
- `GET /containers/{container_id}` — get one container
- `GET /users/{user_id}/containers` — get all containers for user
- `PATCH /containers/{container_id}` — update container (title, filterTags)
- `DELETE /containers/{container_id}` — delete container
- `DELETE /containers?ids=1,2,3` — bulk delete by ids

---

### 🧩 Widgets

`{widget_type}` = notes / forms / archive / calendar-events


- `POST /{widget_type}` — create widget
- `GET /{widget_type}/{widget_id}` — get one widget
- `GET /{widget_type}?user_id=` — get all of type for user
- `GET /{widget_type}?tags=math,bio` — get all matching any tag (in group)
- `GET /{widget_type}?tags=math,bio&match=all` — get all matching exact/all tags
- `PATCH /{widget_type}/{widget_id}` — update widget
- `DELETE /{widget_type}/{widget_id}` — delete widget
- `DELETE /{widget_type}?tags=math,bio` — delete all matching any tag in group

---

### 🖋️ Forms

- `POST /forms/{form_id}/responses` — submit a response
- `GET /forms/{form_id}/responses` — get results/response history

### Links

- `POST /links` — create link between two items
- `DELETE /links/{link_id}` — delete link
- `GET /links?item_id=` — get all links for an item

---

## 🗄️ Database Architecture
The application utilizes a non-relational database structure managed via MongoDB. To maintain high performance and prevent data synchronization issues, collections are strictly decoupled—containers only store UI layouts and filter strings, while cross-widget relationships are isolated in a dedicated links collection.

# Student Dashboard – Data Model

```mermaid
erDiagram
    direction LR
    users ||--o{ notes : "owns"
    users ||--o{ archive : "owns"
    users ||--o{ calendar_events : "owns"
    users ||--o{ forms : "owns"
    users ||--o{ links : "owns"
    users ||--o{ containers : "owns"
    users ||--o{ master_tags : "owns"
    forms ||--o{ form_responses : "has"

    users {
        ObjectId _id PK
        string email UK
        string password_hash
        date created_at
        date updated_at
    }

    master_tags {
        ObjectId _id PK
        ObjectId user_id FK
        string name
        string color
        date created_at
        date updated_at
    }

    containers {
        ObjectId _id PK
        ObjectId user_id FK
        string title
        string type "note|archive|calendar|form"
        ObjectId[] filter_tags "master_tags"
        object layout "x, y, w, h"
        date created_at
        date updated_at
    }

    notes {
        ObjectId _id PK
        ObjectId user_id FK
        string title
        string content "markdown"
        ObjectId[] tags "master_tags"
        date created_at
        date updated_at
    }

    archive {
        ObjectId _id PK
        ObjectId user_id FK
        string filename
        string storage_path
        string mime_type
        int size
        ObjectId[] tags "master_tags"
        date created_at
        date updated_at
    }

    calendar_events {
        ObjectId _id PK
        ObjectId user_id FK
        string title
        string description
        date start_time
        date end_time
        int[] reminders "minutes"
        ObjectId[] tags "master_tags"
        date created_at
        date updated_at
    }

    forms {
        ObjectId _id PK
        ObjectId user_id FK
        string title
        object[] fields "question, input_type, correct_answer"
        ObjectId[] tags "master_tags"
        date created_at
        date updated_at
    }

    form_responses {
        ObjectId _id PK
        ObjectId form_id FK
        ObjectId user_id FK
        object[] answers
        number score
        string result
        date created_at
    }

    links {
        ObjectId _id PK
        ObjectId user_id FK
        ObjectId item_a_id "polymorphic"
        string item_a_type
        ObjectId item_b_id "polymorphic"
        string item_b_type
        date created_at
    }
```

**Legend**
- Every collection has `created_at` / `updated_at` (shown only on `users`).
- Every `user_id` references `users._id`.
- `tags` / `filter_tags` hold `master_tags._id` values.
- `links` is polymorphic: `item_*_type` is a collection name, `item_*_id` its `_id`.

### 👤 Users
Stores authentication credentials and account settings.
*   `user_id`: Unique identifier for the account.
*   `email`: User login address (validated and unique).
*   `password_hash`: Securely hashed password credential.
*   `created_at` / `updated_at`: Timestamps tracking account lifecycle.

### ⚙️ Containers
Lives on the dashboard and represents a saved layout space and filter view.
*   `container_id`: Unique identifier for the container layout block.
*   `user_id`: References the owning user account.
*   `title`: Custom display label set by the user.
*   `type`: Fixed widget type (note, archive, calendar, or form).
*   `filter_tags`: Array of tag ObjectIDs used to query items onto the container.
*   `layout`: Object containing position and sizing parameters { x, y, w, h }.
*   `created_at` / `updated_at`: Creation and last-modified timestamps.

### 🏷️ Master Tags
Acts as a global lookup dictionary for UI autocompletion, settings management, and custom badge styling.
*   `tag_id`: Unique identifier for the tag entry.
*   `user_id`: Isolates tags to the specific user account.
*   `name`: Plain text string matching the tag used across widgets.
*   `color`: Hex code value for visual UI tag badges.
*   `created_at` / `updated_at`: Creation and last-modified timestamps.

### 📝 Notes
Stores markdown documents edited directly within the dashboard.
*   `note_id`: Unique identifier for the note.
*   `user_id`: References the owning user.
*   `title`: Plaintext note title.
*   `content`: Raw Markdown text body.
*   `tags`: Array of tag ObjectIDs assigned to the note.
*   `created_at` / `updated_at`: Creation and edit timestamps.

### 🗂️ Archive
Tracks uploaded files and metadata.
*   `file_id`: Unique identifier for the archive item.
*   `user_id`: References the owning user.
*   `filename`: Original upload file name.
*   `storage_path`: Internal server path where the file is stored.
*   `mime_type`: File format classification (JPEG, PNG, PDF).
*   `size`: File size in bytes.
*   `tags`: Array of tag ObjectIDs assigned to the file.
*   `created_at` / `updated_at`: Upload and modification timestamps.

### 🗓️ Calendar Events
Stores event reminders and scheduled tasks.
*   `event_id`: Unique identifier for the event.
*   `user_id`: References the owning user.
*   `title`: Event title.
*   `description`: Detailed plaintext notes about the event.
*   `start_time` / `end_time`: Datetime objects for scheduling.
*   `tags`: Array of tag ObjectIDs assigned to the event.
*   `created_at` / `updated_at`: Creation and edit timestamps.

### 🧪 Forms
Stores self-testing quizzes and data collection forms.
*   `form_id`: Unique identifier for the form template.
*   `user_id`: References the owning user.
*   `title`: Form title.
*   `fields`: Structured array defining questions, input types, and correct answers.
*   `tags`: Array of tag ObjectIDs assigned to the form.
*   `created_at` / `updated_at`: Creation and modification timestamps.

### 📊 Form Responses
Maintains user submission attempts decoupled from parent forms to prevent document bloat.
*   `response_id`: Unique identifier for the submission.
*   `form_id`: References the parent Form document.
*   `user_id`: References the user who completed the form.
*   `answers`: Object or array holding the submitted responses.
*   `score` / `result`: Calculated completion percentage or test result.
*   `submitted_at`: Submission timestamp.

### 🔗 Links
Stores explicitly connected cross-widget relations.
*   `link_id`: Unique identifier for the relation entry.
*   `user_id`: References the owning user account.
*   `item_a_id` / `item_a_type`: ID and collection type for the first connected item.
*   `item_b_id` / `item_b_type`: ID and collection type for the second connected item.
*   `created_at`: Timestamp when the link was created.

Samuel Svoboda IT3 SŠPU
