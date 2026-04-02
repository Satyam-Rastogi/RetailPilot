# app/__init__.py — intentionally empty.
# Do NOT re-export app.main here: importing any app.* submodule would trigger
# main.py's module-level startup code (create_all, migrations, walk-in seed),
# which breaks Alembic env.py and any other tooling that imports models directly.
