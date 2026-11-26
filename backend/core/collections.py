from models.types import TypesEnum

ITEM_COLLECTIONS = {
    TypesEnum.note: "notes",
    TypesEnum.file: "files",
    TypesEnum.event: "events",
    TypesEnum.form: "forms",
}

ALLOWED_COLLECTIONS = {
    collection: item_type.value
    for item_type, collection in ITEM_COLLECTIONS.items()
}