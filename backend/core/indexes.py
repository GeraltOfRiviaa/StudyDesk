import argparse
import asyncio
from collections import Counter
import sys

from bson import ObjectId
from pydantic import TypeAdapter, ValidationError
from pymongo import IndexModel
from pymongo.collation import Collation
from pymongo.errors import OperationFailure, PyMongoError

from core.collections import ITEM_COLLECTIONS
from models.types import TypesEnum, Username
from models.users import NormalizedEmail


SIMPLE_COLLATION = Collation(locale="simple")
TAG_NAME_COLLATION = Collation(locale="en", strength=2)
LINK_PAIR_KEYS = (
    ("user_id", 1), ("item_a_type", 1), ("item_a_id", 1),
    ("item_b_type", 1), ("item_b_id", 1),
)


def _index(name, keys, *, unique=False, collation=SIMPLE_COLLATION):
    return IndexModel(keys, name=name, unique=unique, collation=collation)


INDEXES = {
    "users": (
        _index("users_email_unique", [("email", 1)], unique=True),
        _index("users_username_unique", [("username", 1)], unique=True),
    ),
    "tags": (
        _index("tags_owner_name_id", [("user_id", 1), ("name", 1), ("_id", 1)], collation=TAG_NAME_COLLATION),
        _index("tags_owner_updated_id", [("user_id", 1), ("updated_at", -1), ("_id", -1)]),
    ),
    **{
        collection: (
            _index(f"{collection}_owner_tags", [("user_id", 1), ("tags", 1)]),
            _index(f"{collection}_owner_updated_id", [("user_id", 1), ("updated_at", -1), ("_id", -1)]),
        )
        for collection in ITEM_COLLECTIONS.values()
    },
    "links": (
        _index("links_pair_unique", LINK_PAIR_KEYS, unique=True),
        _index("links_owner_b", [("user_id", 1), ("item_b_type", 1), ("item_b_id", 1)]),
    ),
    "containers": (
        _index("containers_owner_filter_tags", [("user_id", 1), ("filter_tags", 1)]),
    ),
    "form_responses": (
        _index("form_responses_owner_form_created", [("user_id", 1), ("form_id", 1), ("created_at", -1)]),
        _index("form_responses_form", [("form_id", 1)]),
    ),
}


class IndexSetupError(RuntimeError):
    pass


def _mongo_error(error):
    # MongoDB's message can include a connection string or the conflicting identity value.
    code = getattr(error, "code", None)
    return f"{type(error).__name__} (code {code})" if code is not None else type(error).__name__


def _collation_options(index):
    options = index.get("collation", {"locale": "simple"})
    if options["locale"] == "simple":
        return {"locale": "simple"}
    # listIndexes expands defaults and adds an ICU version. Compare the effective options.
    effective = {
        "caseLevel": False, "caseFirst": "off", "strength": 3, "numericOrdering": False,
        "alternate": "non-ignorable", "maxVariable": "punct", "normalization": False,
        "backwards": False,
    }
    effective.update((key, value) for key, value in options.items() if key != "version")
    return effective


def _signature(index):
    return (
        tuple(index["key"].items()),
        index.get("unique", False),
        _collation_options(index),
        index.get("sparse", False),
        index.get("partialFilterExpression"),
        index.get("expireAfterSeconds"),
    )


async def _inspect_indexes(db):
    missing, issues = [], []
    for collection, definitions in INDEXES.items():
        try:
            existing = await (await db[collection].list_indexes()).to_list()
        except OperationFailure as error:
            if error.code != 26:  # NamespaceNotFound on a fresh database.
                raise IndexSetupError(f"Cannot list indexes on {collection}: {_mongo_error(error)}") from None
            existing = []
        except PyMongoError as error:
            raise IndexSetupError(f"Cannot list indexes on {collection}: {_mongo_error(error)}") from None
        by_name = {index["name"]: index for index in existing}

        for index in existing:
            keys = set(index["key"])
            if not index.get("unique") or "_id" in keys:
                continue
            if collection == "tags":
                issues.append(f"tags.{index['name']} imposes an unapproved uniqueness constraint on tags")
            if collection == "users" and "username" in keys and _collation_options(index)["locale"] != "simple":
                issues.append(f"users.{index['name']} has a collated username uniqueness constraint")

        for definition in definitions:
            expected = definition.document
            name = expected["name"]
            current = by_name.get(name)
            if current is not None:
                if _signature(current) != _signature(expected) or current.get("hidden", False):
                    issues.append(f"{collection}.{name} exists with incompatible keys or options")
                continue

            missing.append((collection, definition))
            for index in existing:
                if _signature(index) == _signature(expected):
                    issues.append(f"{collection}.{name} already exists under the name {index['name']}")
    return missing, issues


async def _user_counts(collection):
    counts = Counter(dict.fromkeys((
        "records", "invalid_email", "noncanonical_email", "duplicate_email_groups",
        "invalid_username", "duplicate_username_groups",
    ), 0))
    email_type = TypeAdapter(NormalizedEmail)
    username_type = TypeAdapter(Username)
    emails, usernames = Counter(), Counter()
    async for doc in collection.find({}, {"email": 1, "username": 1, "_id": 0}):
        counts["records"] += 1
        try:
            raw_email = doc.get("email")
            email = email_type.validate_python(raw_email, strict=True)
            counts["noncanonical_email"] += int(email != raw_email)
            emails[email] += 1
        except ValidationError:
            counts["invalid_email"] += 1
        try:
            username = username_type.validate_python(doc.get("username"), strict=True)
            usernames[username] += 1
        except ValidationError:
            counts["invalid_username"] += 1
    counts["duplicate_email_groups"] = sum(count > 1 for count in emails.values())
    counts["duplicate_username_groups"] = sum(count > 1 for count in usernames.values())
    return counts


async def _link_counts(collection):
    counts = Counter(dict.fromkeys((
        "records", "invalid_endpoints_or_owner", "self_links", "reversed_links", "duplicate_pair_groups",
    ), 0))
    pairs = Counter()
    valid_types = {item_type.value for item_type in TypesEnum}
    async for doc in collection.find({}, {**dict(LINK_PAIR_KEYS), "_id": 0}):
        counts["records"] += 1
        owner = doc.get("user_id")
        a = (doc.get("item_a_type"), doc.get("item_a_id"))
        b = (doc.get("item_b_type"), doc.get("item_b_id"))
        if not isinstance(owner, ObjectId) or not all(
            isinstance(kind, str) and kind in valid_types and isinstance(item_id, ObjectId)
            for kind, item_id in (a, b)
        ):
            counts["invalid_endpoints_or_owner"] += 1
            continue
        if a == b:
            counts["self_links"] += 1
        if a > b:
            counts["reversed_links"] += 1
            a, b = b, a
        # Check both directions as one logical key, even if the stored index keys differ.
        pairs[(owner, a, b)] += 1
    counts["duplicate_pair_groups"] = sum(count > 1 for count in pairs.values())
    return counts


async def _data_preflight(db, collections):
    results, issues = {}, []
    for collection, inspect in (("users", _user_counts), ("links", _link_counts)):
        if collection not in collections:
            continue
        try:
            counts = await inspect(db[collection])
        except PyMongoError as error:
            raise IndexSetupError(f"Cannot check records in {collection}: {_mongo_error(error)}") from None
        results[collection] = counts
        for label, count in counts.items():
            if label != "records" and count:
                issues.append(f"{collection}: {count} {label}")
    return results, issues


async def initialize_indexes(db):
    missing, issues = await _inspect_indexes(db)
    # Scan for legacy identity/pair conflicts before the first unique builds. Restarts
    # with matching constraints skip these full scans. MongoDB enforces exact keys at write time.
    pending_unique = {collection for collection, index in missing if index.document["unique"]}
    _, data_issues = await _data_preflight(db, pending_unique)
    if issues or data_issues:
        raise IndexSetupError("Index preflight failed. " + "; ".join(issues + data_issues))

    for collection, definition in missing:
        try:
            await db[collection].create_indexes([definition])
        except PyMongoError as error:
            name = definition.document["name"]
            raise IndexSetupError(
                f"Cannot create required index {collection}.{name}: {_mongo_error(error)}. "
                "Run python -m core.indexes --check and resolve the conflict before restarting."
            ) from None


async def _check():
    from database import db

    try:
        missing, issues = await _inspect_indexes(db)
        results, data_issues = await _data_preflight(db, ("users", "links"))
        print(f"Required index names missing: {len(missing)}")
        for collection, definition in missing:
            print(f"  {collection}.{definition.document['name']}")
        for collection, counts in results.items():
            print(f"{collection}: " + ", ".join(f"{key}={value}" for key, value in counts.items()))
        for issue in issues + data_issues:
            print(issue, file=sys.stderr)
        return int(bool(issues or data_issues))
    finally:
        await db.client.close()


def main():
    parser = argparse.ArgumentParser(description="Check StudyDesk index compatibility without writing to MongoDB.")
    parser.add_argument("--check", action="store_true", required=True)
    parser.parse_args()
    try:
        return asyncio.run(_check())
    except KeyError as error:
        if error.args != ("MONGO_URL",):
            raise
        print("Set MONGO_URL for the target StudyDesk database.", file=sys.stderr)
    except IndexSetupError as error:
        print(error, file=sys.stderr)
    except PyMongoError as error:
        print(f"Cannot connect to MongoDB: {_mongo_error(error)}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
