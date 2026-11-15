# Fresh database at cutover, no data migration

The new Cliplink starts with an empty database. The old MongoDB had no real Users, and its Links were test data or Anonymous Links, so old Codes return 404 after cutover. This avoids writing a migration from Mongo, and keeps the new code from knowing the old 8-character hex Code format existed.
