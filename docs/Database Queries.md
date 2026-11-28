# Database queries and workflows

This catalog includes implemented workflows and planned Files, Events, Forms, and Dashboard containers. The API serves interactive documentation at `/docs` and the OpenAPI schema at `/openapi.json`.

- `GET /library` returns cursor pages. `GET /notes/` returns a list with `X-Has-More` and, when applicable, `X-Next-Cursor`.
- Tag pickers use cursor pages from `GET /tags/library`. `POST /tags/lookup` resolves up to 100 owned IDs per request.
- `POST /notes/` returns `inserted_id`. The client uses it to create selected links through `POST /links/`.
- Title and tag name searches use escaped case-insensitive substring regex.

## Users

- **F1** Check whether a lowercased email is already in use at registration or profile update.
- **F2** Find a user by their ID
- **F3** Find a user by their case-sensitive username during password login.
- **A1** Create a new user
- **C1** Change user details


## Notes

- **F1** Show everything of that type (tag or not)
- **F2** Show only items with no tags
- **F3** Show items that have at least one of the chosen tags
- **F4** Show items that have all of the chosen tags
- **F5** Show items that have exactly the chosen tags and no others
- **F6** Search by title: the user types a word and gets items whose title contains it (can be combined with tags)
- **F7** Get one item by its ID
-  **A1** Create a new item (check its tags first to see if they exist or need to be created)
- **C1** Edit an item 
- **C2** Add or remove one tag/link on an item
- **D1** Delete an item (and its links)

## Files (planned)

- **F1** Show everything of that type (tag or not)
- **F2** Show only items with no tags
- **F3** Show items that have at least one of the chosen tags
- **F4** Show items that have all of the chosen tags
- **F5** Show items that have exactly the chosen tags and no others
- **F6** Search by title: the user types a word and gets items whose title contains it (can be combined with tags)
- **F7** Get one item by its ID
-  **A1** Create a new item (check its tags first to see if they exist or need to be created)
- **C1** Edit an item (title, content, tags, event times)
- **C2** Add or remove one tag/link on an item
-  **D1** Delete an item (its links and file from disk)

## Events (planned)

- **F1** Show everything of that type (tag or not)
- **F2** Show only items with no tags
- **F3** Show items that have at least one of the chosen tags
- **F4** Show items that have all of the chosen tags
- **F5** Show items that have exactly the chosen tags and no others
- **F6** Search by title: the user types a word and gets items whose title contains it (can be combined with tags)
- **F7** Get one item by its ID
- **F8** Show events that fall in a time range (a single moment works the same way)
-  **A1** Create a new item (check its tags first to see if they exist or need to be created)
- **C1** Edit an item (title, content, tags, event times)
- **C2** Add or remove one tag/link on an item
- **D1** Delete an item (and its links)
## Forms (planned)

- **F1** Show everything of that type (tag or not)
- **F2** Show only items with no tags
- **F3** Show items that have at least one of the chosen tags
- **F4** Show items that have all of the chosen tags
- **F5** Show items that have exactly the chosen tags and no others
- **F6** Search by title: the user types a word and gets items whose title contains it (can be combined with tags)
- **F7** Get one item by its ID
-  **A1** Create a new item (check its tags first to see if they exist or need to be created)

- **C1** Edit an item (title, content, tags, event times)
- **C2** Add or remove one tag/link on an item
-  **D1** Delete an item (and its links)

### Form Responses

- **F1** Find sets of answers to a form (sorted from newest)
- **F2** Find latest set of answers to a form
- **A1** Save a submitted form answers set
- **D1** Delete a set of answers from a form
- **D2** Delete all sets of answers from a form

### Form Questions

- **F1** Find a question input types
- **A1** Add a question
- **A2** Add set of questions
- **C1** Change question fields
- **D1** Delete a question
- **D2** Delete all questions


## Links

- **F1** Get every link connected to one item
- **F2** Check whether two items are already linked
- **A1** Create a link between two items (check both exist, belong to the user, and aren't already linked)
- **D1** Delete a link by its link ID.

## Containers (planned)

- **F1** Get all of a user's containers (runs every time the dashboard opens)
- **F2** Get one container
- **F3** Get what a container shows: take its chosen tags and run the matching tag list below 
- **A1** Create a container (check that its chosen tags belong to the user)
- **C1** Change a container (title, chosen tags, position and size)
- **C2** Save new positions of several containers at once after dragging them around
- **D1** Delete a container without touching the items or tags inside it


## Tags

- **F1** Browse a user's tags in bounded pages.
- **F2** Find tags by their display name. Multiple tags may share the same name and are identified by their IDs.
- **F3** Check that a list of tags really belongs to the user. Takes the user plus a list of tag IDs. It checks that every ID in the list exists and belongs to that user (find those IDs, then compare the count). It runs before saving an item or container with tags.
- **A1** Create a new tag
- **C1** Rename a tag or change its colour
- **D1** Delete a tag



## Additional

- **F1** Show items of all types together in one list

