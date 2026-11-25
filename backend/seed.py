"""StudyDesk demo data. Run only against the local Docker development database."""
import argparse
import asyncio
import os
import random
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from bson import ObjectId

USERNAME = 'studydesk-demo'
EMAIL = 'studydesk-demo@example.com'
PASSWORD = 'StudyDeskDemo123!'
MARKER = 'studydesk-seed-v1'

# Each subject has four notes, with a short useful summary.
SUBJECTS = {
    'Networking': ('#2563EB', [
        ('OSI Model', 'Seven layers describe how data moves between applications and physical media.'),
        ('TCP vs UDP', 'TCP provides reliable ordered delivery; UDP sends independent datagrams.'),
        ('IP Addressing', 'An IP address identifies an interface; a subnet mask defines its network prefix.'),
        ('DNS and DHCP', 'DNS resolves names; DHCP assigns network configuration.')]),
    'Python': ('#16A34A', [
        ('Python Lists', 'Lists are mutable sequences. Use append to add an element.'),
        ('Python Functions', 'Functions group reusable behavior and can return values.'),
        ('Exception Handling', 'Use try and except to handle expected errors.'),
        ('Async Python', 'Await suspends a coroutine while an asynchronous operation completes.')]),
    'Databases': ('#9333EA', [
        ('SQL Basics', 'SELECT reads rows; WHERE filters them.'),
        ('MongoDB Documents', 'MongoDB stores BSON documents in collections.'),
        ('Database Indexes', 'Indexes speed up suitable queries but increase write and storage costs.'),
        ('Database Relationships', 'References connect records; embedded documents keep related data together.')]),
    'Web Development': ('#EA580C', [
        ('React State', 'State stores values that affect rendering.'),
        ('REST API', 'HTTP methods express operations on resources.'),
        ('HTTP Status Codes', '200 means success, 404 means not found, and 500 means server error.'),
        ('CSS Flexbox', 'Flexbox arranges items along a main axis and a cross axis.')]),
    'Mathematics': ('#0891B2', [
        ('Linear Equations', 'Isolate the unknown by applying the same operation to both sides.'),
        ('Quadratic Functions', 'A quadratic function has a parabolic graph.'),
        ('Probability Basics', 'Probability ranges from zero to one.'),
        ('Binary Numbers', 'Binary represents values using powers of two.')]),
    'Operating Systems': ('#DC2626', [
        ('Processes and Threads', 'Processes own resources; threads execute within a process.'),
        ('Virtual Memory', 'Virtual addresses are mapped to physical memory or other backing storage.'),
        ('Linux Commands', 'Use pwd, ls and cd to navigate a shell.'),
        ('File Permissions', 'Read, write and execute permissions control access.')]),
    'Cybersecurity': ('#BE185D', [
        ('Password Hashing', 'A salted password hash helps protect stored credentials.'),
        ('HTTPS', 'TLS protects HTTP traffic in transit.'),
        ('Authentication vs Authorization', 'Authentication identifies a user; authorization checks permissions.'),
        ('Phishing Awareness', 'Verify unexpected requests before opening links or sharing information.')]),
    'Git': ('#B45309', [
        ('Git Basics', 'Commits record snapshots of tracked files.'),
        ('Git Branches', 'Branches are movable references to commits.'),
        ('Merge Conflicts', 'Resolve incompatible edits before completing a merge.'),
        ('Git Remote Repositories', 'Fetch downloads remote references; push uploads local commits.')]),
    'Exam Prep': ('#475569', [
        ('Networking Revision', 'Review addressing, routing, protocols and the OSI model.'),
        ('Programming Revision', 'Practice loops, functions and basic data structures.'),
        ('Database Revision', 'Practice queries, indexes and data modeling.'),
        ('Mock Exam Checklist', 'Prepare materials and practice explaining concepts aloud.')]),
    'School Projects': ('#0D9488', [
        ('StudyDesk Architecture', 'React communicates with FastAPI, which accesses MongoDB.'),
        ('Library Filters', 'Test filtering by type, title and tags.'),
        ('Demo Presentation', 'Show note editing, Markdown, tags and related items.'),
        ('Project Testing', 'Check normal usage, empty states and invalid input.')]),
}

rng = random.Random(42)


def timestamps(now):
    created = now - timedelta(days=rng.randint(2, 120), hours=rng.randint(0, 23))
    updated = created + (now - created) * rng.random()
    return {'created_at': created, 'updated_at': updated}


async def seed_user(db, hash_password, now, create=True):
    existing = await db.users.find_one({'$or': [{'username': USERNAME}, {'email': EMAIL}]})
    if existing:
        if existing.get('seed_marker') != MARKER or existing.get('username') != USERNAME or existing.get('email') != EMAIL:
            raise SystemExit('Demo username/email already belongs to another account. No data changed.')
        return existing['_id'], False
    if not create:
        return None, False
    from models.users import UserCreate
    user = UserCreate(username=USERNAME, email=EMAIL, password=PASSWORD)
    result = await db.users.insert_one({
        'username': user.username, 'email': user.email, 'password_hash': hash_password(user.password),
        'seed_marker': MARKER, 'created_at': now, 'updated_at': now,
    })
    return result.inserted_id, True


async def seed_tags(db, uid, now):
    from models.tag import TagCreate
    docs = [{'_id': ObjectId(), 'user_id': uid, **TagCreate(name=name, color=color).model_dump(),
             **timestamps(now)}
            for name, (color, _) in SUBJECTS.items()]
    await db.tags.insert_many(docs)
    return {doc['name']: doc['_id'] for doc in docs}


async def seed_notes(db, uid, tags, now):
    from models.note import NoteCreate
    docs = []
    for subject, (_, topics) in SUBJECTS.items():
        for index, (title, summary) in enumerate(topics):
            names = [subject]
            if index == 1 and subject != 'Exam Prep':
                names.append('Exam Prep')
            if index == 2:
                names += rng.sample([name for name in tags if name != subject], 2)
            if index == 3 and subject in ('Git', 'Mathematics'):
                names = []  # Exercise the untagged filter.
            content = f'# {title}\n\n{summary}\n\n## Revision checklist\n\n- [x] Read the summary\n- [ ] Explain it in my own words\n- [ ] Try a practical example\n\n**Study tip:** Review this topic before the next lesson.'
            note = NoteCreate(title=title, content=content, tags=[str(tags[name]) for name in names])
            docs.append({'_id': ObjectId(), 'user_id': uid, 'title': note.title,
                         'content': note.content, 'tags': [ObjectId(t) for t in note.tags],
                         **timestamps(now)})
    await db.notes.insert_many(docs)
    return docs


async def seed_links(db, uid, notes, now):
    from models.link import LinkBase
    from models.types import TypesEnum
    docs = []
    # Link adjacent topics within each subject: three links per subject.
    for start in range(0, len(notes), 4):
        for index in range(start, start + 3):
            a, b = sorted((notes[index]['_id'], notes[index + 1]['_id']), key=str)
            link = LinkBase(item_a_id=str(a), item_b_id=str(b),
                            item_a_type=TypesEnum.note, item_b_type=TypesEnum.note)
            docs.append({'user_id': uid, 'item_a_id': ObjectId(link.item_a_id),
                         'item_a_type': link.item_a_type.value,
                         'item_b_id': ObjectId(link.item_b_id),
                         'item_b_type': link.item_b_type.value,
                         'created_at': now})
    await db.links.insert_many(docs)


async def clear_demo_data(db, uid):
    # Deliberately reset the dedicated demo workspace, never another user's data.
    for collection in ('links', 'containers', 'notes', 'tags', 'files', 'events', 'forms'):
        result = await db[collection].delete_many({'user_id': uid})
        if result.deleted_count:
            print(f'Removed {result.deleted_count} from {collection}')


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--reset', action='store_true', help='Replace the demo workspace data.')
    modes.add_argument('--clear', action='store_true', help='Empty the demo workspace; retain its login.')
    parser.add_argument('--dev', action='store_true', required=True, help='Confirm this is a development database.')
    args = parser.parse_args()
    url = urlsplit(os.environ.get('MONGO_URL', ''))
    if url.scheme != 'mongodb' or url.hostname not in {'mongodb', 'localhost', '127.0.0.1', '::1'} or ',' in url.netloc:
        raise SystemExit('Refusing to seed a non-local MongoDB connection.')

    from database import db
    from core.security import hash_password

    try:
        await db.command('ping')
        now = datetime.now(timezone.utc)
        uid, created = await seed_user(db, hash_password, now, create=not args.clear)
        if uid is None:
            print('No demo account found.')
            return
        if args.clear or args.reset:
            await clear_demo_data(db, uid)
        elif not created:
            print('Demo account already exists. Use --reset to regenerate its workspace.')
            return
        if args.clear:
            print('Demo workspace cleared; login retained.')
            return
        tags = await seed_tags(db, uid, now)
        notes = await seed_notes(db, uid, tags, now)
        await seed_links(db, uid, notes, now)
        print(f'Seeded {len(tags)} tags, {len(notes)} notes and 30 links.')
        print(f'Username: {USERNAME}\nPassword: {PASSWORD}')
    finally:
        await db.client.close()


if __name__ == '__main__':
    asyncio.run(main())
