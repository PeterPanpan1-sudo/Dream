import sqlite3
import subprocess
import sys
import os

def escape_value(val):
    if val is None:
        return 'NULL'
    if isinstance(val, int):
        return str(val)
    if isinstance(val, float):
        return str(val)
    s = str(val).replace("'", "''")
    return f"'{s}'"

def dump_table(conn, table_name):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    row = cursor.fetchone()
    if row and row[0]:
        yield f"DROP TABLE IF EXISTS \"{table_name}\";"
        yield f"{row[0]};"
    else:
        return

    cursor.execute(f"SELECT * FROM \"{table_name}\"")
    columns = [desc[0] for desc in cursor.description]
    col_str = ', '.join(f'"{c}"' for c in columns)
    for row in cursor.fetchall():
        vals = ', '.join(escape_value(v) for v in row)
        yield f"INSERT INTO \"{table_name}\" ({col_str}) VALUES ({vals});"
    yield ""

def main():
    db_path = os.path.join(os.path.dirname(__file__), 'data', 'daydream.db')
    sql_path = os.path.join(os.path.dirname(__file__), 'data', 'sync_d1.sql')

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    tables = [r[0] for r in cursor.fetchall()]

    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write("PRAGMA foreign_keys=OFF;\n\n")
        for table in tables:
            for line in dump_table(conn, table):
                f.write(line + "\n")

    conn.close()
    print(f"SQL dumped to {sql_path}")

    # Run wrangler d1 execute
    print("Uploading to Cloudflare D1...")
    cmd = [
        'npx', 'wrangler', 'd1', 'execute', 'image',
        '--remote', f'--file={sql_path}'
    ]
    result = subprocess.run(' '.join(cmd), cwd=os.path.dirname(__file__), input="Y\n", text=True, encoding='utf-8', shell=True)
    sys.exit(result.returncode)

if __name__ == '__main__':
    main()
