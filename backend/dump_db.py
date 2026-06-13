import sqlite3
import sys

def escape_value(val):
    if val is None:
        return 'NULL'
    if isinstance(val, int):
        return str(val)
    if isinstance(val, float):
        return str(val)
    # String: escape single quotes
    s = str(val).replace("'", "''")
    return f"'{s}'"

def dump_table(conn, table_name):
    cursor = conn.cursor()
    # CREATE TABLE
    cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    row = cursor.fetchone()
    if row and row[0]:
        print(f"{row[0]};")
    else:
        return

    # INSERT statements
    cursor.execute(f"SELECT * FROM \"{table_name}\"")
    columns = [desc[0] for desc in cursor.description]
    col_str = ', '.join(f'"{c}"' for c in columns)
    for row in cursor.fetchall():
        vals = ', '.join(escape_value(v) for v in row)
        print(f"INSERT INTO \"{table_name}\" ({col_str}) VALUES ({vals});")
    print()

def main():
    db_path = 'D:/daydream-studio/backend/data/daydream.db'
    if len(sys.argv) > 1:
        db_path = sys.argv[1]

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all user tables (exclude sqlite_ internal tables)
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    tables = [r[0] for r in cursor.fetchall()]

    # Foreign keys may cause issues with D1, disable them in dump
    print("PRAGMA foreign_keys=OFF;")
    print("BEGIN TRANSACTION;")
    print()

    for table in tables:
        dump_table(conn, table)

    print("COMMIT;")
    conn.close()

if __name__ == '__main__':
    main()
