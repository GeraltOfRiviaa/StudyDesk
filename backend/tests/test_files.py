import os
import unittest
from datetime import datetime, timezone
from pathlib import Path
from secrets import token_hex
from tempfile import NamedTemporaryFile, TemporaryDirectory
from unittest.mock import AsyncMock, Mock, patch

from bson import ObjectId
from pydantic import ValidationError

with patch.dict(os.environ, {"MONGO_URL": "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"}):
    from main import create_app

from core.file_config import FileSettings, load_file_settings
from core.storage import StorageError, generate_storage_path, resolve_storage_path, verify_storage
from models.files import FileCreate, FilePublic, FileStatusEnum, FileUpdate
from models.types import MimeTypesEnum


OWNER = ObjectId()
FILE = ObjectId()
PDF_PATH = f"{OWNER}/{FILE}.pdf"


class FileModelTests(unittest.TestCase):
    def test_create_and_update_accept_only_editable_metadata(self):
        self.assertEqual(FileCreate(title="Lecture").model_dump(), {"title": "Lecture", "tags": []})
        self.assertEqual(FileUpdate(tags=[]).model_dump(exclude_unset=True), {"tags": []})
        for model, payload in (
            (FileCreate, {"title": "Lecture", "filename": "slides.pdf"}),
            (FileCreate, {"title": "Lecture", "links": []}),
            (FileCreate, {"title": "Lecture", "tags": ["invalid"]}),
            (FileUpdate, {}),
            (FileUpdate, {"title": None}),
            (FileUpdate, {"tags": None}),
            (FileUpdate, {"status": "ready"}),
        ):
            with self.subTest(model=model.__name__, payload=payload), self.assertRaises(ValidationError):
                model.model_validate(payload)

    def test_public_response_omits_storage_metadata(self):
        now = datetime.now(timezone.utc)
        file = FilePublic(
            id=FILE, title="Lecture", filename="slides.pdf", mime_type="application/pdf",
            size=20971520, created_at=now, updated_at=now,
            storage_path=PDF_PATH, sha256="a" * 64, status=FileStatusEnum.ready,
        ).model_dump(mode="json")
        self.assertEqual(set(file), {
            "id", "title", "tags", "filename", "mime_type", "size", "created_at", "updated_at",
        })
        self.assertEqual(file["id"], str(FILE))
        self.assertEqual(file["size"], 20971520)


class FileSettingsTests(unittest.TestCase):
    def test_defaults_and_equal_quota_limits(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(load_file_settings(), FileSettings(Path("/data/uploads"), 10485760, 524288000, 4294967296))
        with patch.dict(os.environ, {
            "FILE_MAX_SIZE": "42", "FILE_USER_QUOTA": "42", "FILE_GLOBAL_QUOTA": "42",
        }, clear=True):
            self.assertEqual(load_file_settings(), FileSettings(Path("/data/uploads"), 42, 42, 42))

    def test_rejects_invalid_and_inconsistent_settings(self):
        for overrides, message in (
            ({"FILE_STORAGE_ROOT": " "}, "FILE_STORAGE_ROOT"),
            ({"FILE_MAX_SIZE": "1.5"}, "positive integer"),
            ({"FILE_USER_QUOTA": "0"}, "positive integer"),
            ({"FILE_GLOBAL_QUOTA": "-1"}, "positive integer"),
            ({"FILE_MAX_SIZE": "524288001"}, "must satisfy"),
            ({"FILE_USER_QUOTA": "4294967297"}, "must satisfy"),
        ):
            with self.subTest(overrides=overrides), patch.dict(os.environ, overrides, clear=True):
                with self.assertRaisesRegex(RuntimeError, message):
                    load_file_settings()


class FileStorageTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(TemporaryDirectory())).resolve()

    def test_generates_and_resolves_canonical_paths(self):
        for mime_type, extension in (
            (MimeTypesEnum.pdf, "pdf"), (MimeTypesEnum.png, "png"), (MimeTypesEnum.jpeg, "jpg"),
        ):
            with self.subTest(mime_type=mime_type):
                relative_path = generate_storage_path(OWNER, FILE, mime_type)
                self.assertEqual(relative_path, f"{OWNER}/{FILE}.{extension}")
                self.assertEqual(resolve_storage_path(self.root, relative_path), self.root / relative_path)
                staging_path = relative_path + ".tmp"
                self.assertEqual(resolve_storage_path(self.root, staging_path), self.root / staging_path)

        target = self.root / PDF_PATH
        target.parent.mkdir()
        target.touch()
        self.assertEqual(resolve_storage_path(self.root, PDF_PATH), target)
        with self.assertRaisesRegex(StorageError, "BSON ObjectIds"):
            generate_storage_path("..", FILE, MimeTypesEnum.pdf)
        with self.assertRaisesRegex(StorageError, "Unsupported MIME type"):
            generate_storage_path(OWNER, FILE, "text/plain")

    def test_rejects_paths_outside_the_managed_format(self):
        for path in (f"/{PDF_PATH}", f"C:/{PDF_PATH}", f"{OWNER}/../{FILE}.pdf",
                     PDF_PATH.replace("/", "\\"), PDF_PATH + ".tmp.tmp", f"{OWNER}/{FILE}.jpeg"):
            with self.subTest(path=path), self.assertRaisesRegex(StorageError, "Invalid managed storage path"):
                resolve_storage_path(self.root, path)

    def test_rejects_wrong_filesystem_entry_types(self):
        target = self.root / PDF_PATH
        target.parent.touch()
        with self.assertRaisesRegex(StorageError, "parent must be a directory"):
            resolve_storage_path(self.root, PDF_PATH)
        target.parent.unlink()
        target.mkdir(parents=True)
        with self.assertRaisesRegex(StorageError, "destination must be a regular file"):
            resolve_storage_path(self.root, PDF_PATH)

    def test_rejects_symlinked_roots_parents_and_destinations(self):
        real_directory = self.root / "real"
        real_directory.mkdir()
        root_link = self.root / "linked-root"
        try:
            root_link.symlink_to(real_directory, target_is_directory=True)
        except OSError as error:
            if os.name == "nt" and getattr(error, "winerror", None) == 1314:
                self.skipTest("Windows symlink creation requires additional privileges")
            raise

        with self.assertRaisesRegex(StorageError, "symbolic links"):
            verify_storage(root_link)
        with self.assertRaisesRegex(StorageError, "symbolic links"):
            verify_storage(root_link / "nested")

        target = self.root / PDF_PATH
        target.parent.symlink_to(real_directory, target_is_directory=True)
        with self.assertRaisesRegex(StorageError, "symbolic links"):
            resolve_storage_path(self.root, PDF_PATH)
        target.parent.unlink()
        target.parent.mkdir()
        target.symlink_to(real_directory / "missing.pdf")
        with self.assertRaisesRegex(StorageError, "symbolic links"):
            resolve_storage_path(self.root, PDF_PATH)

    def test_probe_is_removed_after_success_and_read_failure(self):
        verify_storage(self.root)
        self.assertEqual(list(self.root.iterdir()), [])

        def unreadable_probe(**options):
            probe = NamedTemporaryFile(**options)
            probe.read = Mock(side_effect=OSError("probe read failed"))
            return probe

        with patch("core.storage.NamedTemporaryFile", side_effect=unreadable_probe):
            with self.assertRaisesRegex(StorageError, "probe read failed"):
                verify_storage(self.root)
        self.assertEqual(list(self.root.iterdir()), [])

    def test_root_cannot_overlap_application_directory(self):
        with self.assertRaisesRegex(StorageError, "separate from the application"):
            verify_storage(Path(__file__).resolve().parent)


class FileStorageLifespanTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(TemporaryDirectory())).resolve()
        self.enterContext(patch.dict(os.environ, {
            "JWT_SECRET": token_hex(32), "FILE_STORAGE_ROOT": str(self.root),
        }, clear=True))
        self.indexes = self.enterContext(patch("main.initialize_indexes", AsyncMock()))

    async def test_valid_storage_allows_startup_without_file_endpoints(self):
        app = create_app()
        async with app.router.lifespan_context(app):
            self.assertEqual(app.state.file_settings.root, self.root)
            self.indexes.assert_awaited_once()
            self.assertFalse(any(path.startswith(("/files", "/archive")) for path in app.openapi()["paths"]))

    async def test_invalid_storage_stops_startup_before_index_setup(self):
        for overrides, message in (
            ({"FILE_STORAGE_ROOT": str(self.root / "missing")}, "FILE_STORAGE_ROOT is unusable"),
            ({"FILE_USER_QUOTA": "1"}, "must satisfy"),
        ):
            with self.subTest(overrides=overrides), patch.dict(os.environ, overrides):
                app = create_app()
                with self.assertRaisesRegex(RuntimeError, message):
                    async with app.router.lifespan_context(app):
                        self.fail("Invalid file settings must block startup")
        self.indexes.assert_not_awaited()
