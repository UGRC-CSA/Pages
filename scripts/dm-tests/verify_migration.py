"""Exercise the additive SQLite migration against populated, isolated test data."""
import importlib.util
from contextlib import closing
from pathlib import Path
import sqlite3
import sys
import tempfile

spring = Path(sys.argv[1]).resolve()
spec = importlib.util.spec_from_file_location("migrate_dm", spring / "scripts/migrate_dm.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
with tempfile.TemporaryDirectory(prefix="dm-migration-") as directory:
    database = Path(directory) / "existing.db"
    with closing(sqlite3.connect(database)) as connection:
        connection.execute('CREATE TABLE "groups" (id INTEGER PRIMARY KEY, name TEXT)')
        connection.executemany('INSERT INTO "groups" VALUES (?, ?)', [(1, "Class chat"), (2, "Class chat")])
        connection.commit()
    migration.migrate(database)
    migration.migrate(database)
    with closing(sqlite3.connect(database)) as connection:
        assert connection.execute('SELECT id, name FROM "groups" ORDER BY id').fetchall() == [(1, "Class chat"), (2, "Class chat")]
        connection.execute('UPDATE "groups" SET dm_key = ? WHERE id = 1', ("dm-10-20",))
        try:
            connection.execute('UPDATE "groups" SET dm_key = ? WHERE id = 2', ("dm-10-20",))
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("Duplicate DM keys must be rejected")
        connection.execute('INSERT INTO dm_read_receipt VALUES (?, ?)', ("1:10", "2026-01-01T00:00:00Z"))
        connection.commit()
    assert list(Path(directory).glob("*.bak")), "Migration must create a backup"
print("PASS Migration: repeatable, preserves existing groups, unique DM keys, read receipt storage, backup created")
