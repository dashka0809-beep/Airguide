#!/usr/bin/env python3
"""
apply_db.py — Schema (+ optionally seed) -г Postgres-руу ачаалах.

Хэрэглэх:
    # 1) URL-аа env var-д тавь (PowerShell):
    #    $env:DATABASE_URL = "postgresql://user:pass@host:port/dbname"
    # 2) Ажиллуул:
    python scripts/apply_db.py extensions schema       # зөвхөн схем
    python scripts/apply_db.py extensions schema seed  # схем + sample data
    python scripts/apply_db.py verify                  # хүснэгтийн тоо шалгах

Эсвэл command-line-аар URL дамжуулна:
    python scripts/apply_db.py --url "postgresql://..." extensions schema

⚠️ Production-д энэ script-г ашиглахгүй — dbmate migration ашигла.
"""

from __future__ import annotations

import argparse
import os
import re
import ssl
import sys
import urllib.parse
from pathlib import Path

import pg8000.native


# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent
DB_DIR = ROOT_DIR / "db"

FILES = {
    "extensions": DB_DIR / "extensions.sql",
    "schema":     DB_DIR / "schema.sql",
    "seed":       DB_DIR / "seed.sql",
}


def parse_db_url(url: str) -> dict:
    """postgresql://user:pass@host:port/dbname → dict for pg8000.connect()"""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("postgresql", "postgres"):
        raise ValueError(f"Expected postgresql:// URL, got: {parsed.scheme}")

    return {
        "user":     urllib.parse.unquote(parsed.username or ""),
        "password": urllib.parse.unquote(parsed.password or ""),
        "host":     parsed.hostname or "localhost",
        "port":     parsed.port or 5432,
        "database": (parsed.path or "/").lstrip("/") or "postgres",
    }


def connect(url: str) -> pg8000.native.Connection:
    """Холбогдох — Railway public URL-д SSL шаардлагатай."""
    cfg = parse_db_url(url)

    # Railway public URL → SSL заавал
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    return pg8000.native.Connection(ssl_context=ctx, **cfg)


# ----------------------------------------------------------------------------
# SQL splitter — pg8000 нь нэг үед нэг statement л зөвшөөрдөг
# ----------------------------------------------------------------------------
def split_sql_statements(sql: str) -> list[str]:
    """
    SQL текстийг statement-уудад хуваана. Хүлээж байгаа онцлох тохиолдол:
      - PostgreSQL $$...$$ dollar-quoted блок (trigger function-д хэрэглэгдэнэ)
      - Тайлбар (-- ...)
      - Олон мөртэй statement
    """
    statements = []
    current = []
    in_dollar_block = False
    dollar_tag = None

    # Сатрын тайлбарыг арилгая (гэхдээ $$ блок дотор биш)
    lines = sql.split("\n")
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        cleaned_lines.append(line)
    sql_clean = "\n".join(cleaned_lines)

    i = 0
    while i < len(sql_clean):
        # $$ блок эхлэх/дуусах
        if not in_dollar_block:
            m = re.match(r"\$([a-zA-Z_]*)\$", sql_clean[i:])
            if m:
                dollar_tag = m.group(0)
                in_dollar_block = True
                current.append(dollar_tag)
                i += len(dollar_tag)
                continue
        else:
            if sql_clean[i:].startswith(dollar_tag):
                current.append(dollar_tag)
                i += len(dollar_tag)
                in_dollar_block = False
                dollar_tag = None
                continue

        ch = sql_clean[i]

        # Statement дуусах ; (зөвхөн $$ блокоос гадуур)
        if ch == ";" and not in_dollar_block:
            current.append(";")
            stmt = "".join(current).strip()
            if stmt and stmt != ";":
                statements.append(stmt)
            current = []
        else:
            current.append(ch)

        i += 1

    # Үлдсэн (хэрвээ ; -гүй төгссөн бол)
    remainder = "".join(current).strip()
    if remainder:
        statements.append(remainder)

    return statements


def short_label(stmt: str, max_len: int = 70) -> str:
    """Statement-ыг log-д харуулах товч хэлбэр."""
    label = " ".join(stmt.split())  # whitespace normalize
    if len(label) > max_len:
        label = label[:max_len] + "..."
    return label


# ----------------------------------------------------------------------------
# Apply
# ----------------------------------------------------------------------------
def apply_file(conn: pg8000.native.Connection, path: Path) -> tuple[int, int]:
    """Файлыг ажиллуулна. Буцаах: (succeeded, failed)"""
    print(f"\n📂 {path.relative_to(ROOT_DIR)}")
    sql = path.read_text(encoding="utf-8")
    statements = split_sql_statements(sql)
    print(f"   {len(statements)} statement(s)")

    ok, fail = 0, 0
    for idx, stmt in enumerate(statements, 1):
        label = short_label(stmt)
        try:
            conn.run(stmt)
            ok += 1
            print(f"   [{idx:>3}/{len(statements)}] ✓ {label}")
        except Exception as e:
            fail += 1
            print(f"   [{idx:>3}/{len(statements)}] ✗ {label}")
            print(f"          ERROR: {e}")
    print(f"   ✅ {ok} succeeded, ❌ {fail} failed")
    return ok, fail


def verify(conn: pg8000.native.Connection):
    """Хүснэгтийн тоог шалгана."""
    print("\n🔍 Verifying database state...\n")

    rows = conn.run("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
        ORDER BY table_name
    """)
    print(f"📋 Tables ({len(rows)} total):")
    for (name,) in rows:
        count = conn.run(f"SELECT COUNT(*) FROM {name}")[0][0]
        print(f"   {name:<15} {count:>5} rows")

    rows = conn.run("""
        SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY viewname
    """)
    print(f"\n🔭 Views ({len(rows)}):")
    for (name,) in rows:
        print(f"   {name}")

    rows = conn.run("""
        SELECT extname, extversion FROM pg_extension ORDER BY extname
    """)
    print(f"\n🧩 Extensions ({len(rows)}):")
    for name, version in rows:
        print(f"   {name} v{version}")

    rows = conn.run("""
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema='public'
        ORDER BY event_object_table, trigger_name
    """)
    print(f"\n⚡ Triggers ({len(rows)}):")
    for name, table in rows:
        print(f"   {table:<12} → {name}")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Apply DB files to Postgres.")
    parser.add_argument("steps", nargs="+",
                        choices=["extensions", "schema", "seed", "verify"],
                        help="Аль файлуудыг хэрхэн дэс дараалалд ажиллуулах вэ?")
    parser.add_argument("--url", help="Postgres URL (env DATABASE_URL-аас уншна)")
    args = parser.parse_args()

    url = args.url or os.environ.get("DATABASE_URL")
    if not url:
        print("❌ DATABASE_URL env var тохируулна уу эсвэл --url ашиглана уу.", file=sys.stderr)
        sys.exit(1)

    # Хэрэглэгчид URL-ын зөвхөн host-г харуулах (нууц үг далдална)
    cfg = parse_db_url(url)
    print(f"🔌 Connecting to {cfg['user']}@{cfg['host']}:{cfg['port']}/{cfg['database']}")

    try:
        conn = connect(url)
        print("   Connected ✓")
    except Exception as e:
        print(f"❌ Connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    total_fail = 0
    try:
        for step in args.steps:
            if step == "verify":
                verify(conn)
            else:
                _, fail = apply_file(conn, FILES[step])
                total_fail += fail
    finally:
        conn.close()

    if total_fail > 0:
        print(f"\n⚠️  Total {total_fail} statement(s) failed.")
        sys.exit(2)
    print("\n✅ Done.")


if __name__ == "__main__":
    main()
