import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db


source_path = Path(os.environ.get("SOURCE_SQLITE_PATH", "instance/financas.db")).resolve()
target_url = os.environ["TARGET_DATABASE_URL"]
source = create_engine(f"sqlite:///{source_path}")
target = create_engine(target_url, pool_pre_ping=True)

tables = [db.metadata.tables[name] for name in ("user", "entry", "claude_analysis")]
db.metadata.create_all(target)

with target.connect() as connection:
    occupied = {table.name: connection.execute(select(db.func.count()).select_from(table)).scalar_one() for table in tables}
if any(occupied.values()):
    raise SystemExit(f"Migração cancelada: o destino contém dados: {occupied}")

counts = {}
with source.connect() as source_connection, target.begin() as target_connection:
    source_tables = set(inspect(source).get_table_names())
    for table in tables:
        if table.name not in source_tables:
            counts[table.name] = 0
            continue
        rows = [dict(row._mapping) for row in source_connection.execute(select(table))]
        if rows:
            target_connection.execute(table.insert(), rows)
        counts[table.name] = len(rows)

with target.connect() as connection:
    verified = {table.name: connection.execute(select(db.func.count()).select_from(table)).scalar_one() for table in tables}
if counts != verified:
    raise SystemExit(f"Falha na conferência: origem={counts}, destino={verified}")
print(f"Migração concluída e conferida: {verified}")
