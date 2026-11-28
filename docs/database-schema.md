# StudyDesk Database Schema

## Purpose and status

This document transcribes the MongoDB database design diagram. It is a design reference, not a guarantee that every collection or field is implemented. Check the current backend models and collection mappings before making changes.

### Naming differences

| Diagram | Current implementation |
|---|---|
| `archive` | `files` |
| `master_tags` | `tags` |

The diagram's container types are `note`, `archive`, `calendar`, and `form`. Current item types are `note`, `file`, `event`, and `form`. Container types should be reconciled when containers are implemented. The sections below use current collection names where known.

## Collections

### users

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `nickname` | string | Unique |
| `email` | string | Unique |
| `password_hash` | string | Password hash |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

The diagram predates Google-only authentication support; consult the current user model for authentication fields and nullability.

### notes

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | References users |
| `title` | string | Note title |
| `content` | string | Markdown content |
| `tags` | ObjectId[] | References tags |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

### files (archive in diagram)

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | References users |
| `title` | string | Display title |
| `filename` | string | File name |
| `storage_path` | string | Stored file location |
| `mime_type` | string | MIME type |
| `size` | int | File size |
| `tags` | ObjectId[] | References tags |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

### events

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | References users |
| `title` | string | Event title |
| `description` | string | Event description |
| `start_time` | date | Start |
| `end_time` | date | End |
| `timezone` | string | IANA timezone string |
| `repetition` | object or null | Embedded repetition object |
| `exceptions` | array | Dates excluded from repetition |
| `reminders` | int[] | Minutes |
| `tags` | ObjectId[] | References tags |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

### forms

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | References users |
| `title` | string | Form title |
| `questions` | object[] | Embedded form_questions |
| `tags` | ObjectId[] | References tags |
| `time_to_finish` | int | Time to finish |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

### form_responses

Separate collection; responses are not embedded in forms.

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `form_id` | ObjectId | References forms |
| `user_id` | ObjectId | References users |
| `answers` | object[] | Embedded form_answer objects |
| `score` | number | Score |
| `result` | string | Result |
| `finish_time` | int | Finish time |
| `created_at` | date | Creation date |

### links

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | References users |
| `item_a_id` | ObjectId | Polymorphic item reference |
| `item_a_type` | string | Type of item A |
| `item_b_id` | ObjectId | Polymorphic item reference |
| `item_b_type` | string | Type of item B |
| `created_at` | date | Creation date |

### containers

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | References users |
| `title` | string | Container title |
| `type` | string | Diagram: note, archive, calendar, form |
| `filter_tags` | ObjectId[] | References tags |
| `layout` | object | Embedded layout |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

### tags (master_tags in diagram)

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Primary key |
| `user_id` | ObjectId | References users |
| `name` | string | Tag name |
| `color` | string | Tag color |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

## Embedded objects

These are nested inside parent documents, not separate MongoDB collections.

### repetition

Parent: `events.repetition`.

| Field | Type | Description |
|---|---|---|
| `repetition_type` | enum | daily, weekly, monthly, yearly |
| `interval` | int | Repetition interval |
| `target_day` | enum | mo, tu, we, th, fr, sa, su |
| `until` | date or null | End date of repetition |

### form_questions

Parent: `forms.questions[]`.

| Field | Type | Description |
|---|---|---|
| `id` | string | Question ID |
| `input_type` | enum | single, multiple, yes/no |
| `title` | string | Question title |
| `options` | array | Embedded form_options |
| `correct_options` | string[] | Correct option IDs; excluded from test-taking projection |
| `created_at` | date | Creation date |
| `updated_at` | date | Last update |

### form_options

Parent: `forms.questions[].options[]`.

| Field | Type | Description |
|---|---|---|
| `id` | string | Option ID |
| `answer` | string | Answer text |
| `description` | string | Option description |

### form_answer

Parent: `form_responses.answers[]`.

| Field | Type | Description |
|---|---|---|
| `question_id` | string | References embedded question ID |
| `option_id` | string | References embedded option ID |

### layout

Parent: `containers.layout`.

| Field | Type | Description |
|---|---|---|
| `x` | int | Horizontal position |
| `y` | int | Vertical position |
| `w` | int | Width |
| `h` | int | Height |

## Relationships

| Parent | Related data | Relationship |
|---|---|---|
| users | notes, files, events, forms, links, containers, tags, form_responses | One-to-many ownership via user_id |
| tags | notes, files, events, forms | Referenced through tags arrays |
| tags | containers | Referenced through filter_tags |
| forms | form_responses | One-to-many via form_id |
| forms | questions and options | Embedded |
| form_responses | answers | Embedded |
| events | repetition, exceptions, reminders | Embedded |
| containers | layout | Embedded |
| items | links | Polymorphic references to either endpoint |

## Implementation guidance (agreed design direction)

The following rules supplement the diagram; they are not claims that future features are already implemented.

- Main Library item types are notes, files, events and forms. Use the existing collection mapping rather than duplicating collection names.
- Common item fields are `_id`, `user_id`, `title`, `tags`, `created_at` and `updated_at`.
- Shared creation and update helpers can prepare common fields; type-specific routers remain responsible for validation and persistence of their own fields. Never allow updates to change ownership, IDs or creation timestamps.
- Scope item retrieval, modification and deletion to the authenticated user.
- Links are bidirectional. Remove links referencing deleted items on either side.
- Deleting a form must also remove its associated response documents. Embedded questions and options disappear with the form itself.
- Form editing and test-taking must use appropriate separate response models/projections. Never expose correct answers in test-taking responses.
- Deleting a file must also account for physical storage cleanup once implemented.
- Event reminders are embedded in the diagram; any future external scheduled jobs will require separate cleanup.
- Deleting a tag must remove its references from item tags and container filter_tags.
- Account deletion must cover all owned collections and future external storage.
- MongoDB references do not automatically enforce foreign keys or cascade deletion. Handle dependency cleanup and partial failures explicitly.

## Open design details

The diagram does not specify all validation rules, defaults, indexes, time units for form timing fields, file size units, or storage implementation. Do not invent these as established requirements. Consult current code and confirm unresolved decisions before implementing new features.
