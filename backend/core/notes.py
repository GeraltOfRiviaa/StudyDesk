
from models.note import NoteListItem, NotePublic


########################################################


# Transfer note result from queries to NotePublic class




def to_note(doc: dict) -> NotePublic:
    return NotePublic(
        id=str(doc["_id"]),
        title=doc["title"],
        content=str(doc["content"]),
        tags=[str(t) for t in doc["tags"]],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )
    
def to_note_item(doc: dict) -> NoteListItem:
    return NoteListItem(
            id=str(doc["_id"]),
            title=doc["title"],
            tags=[str(t) for t in doc["tags"]],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )


########################################################