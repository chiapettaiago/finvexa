import os
from pathlib import Path


env_path = Path(".env")
new_line = f"DATABASE_URL={os.environ['TARGET_DATABASE_URL']}"
lines = env_path.read_text().splitlines() if env_path.exists() else []
updated = []
replaced = False
for line in lines:
    if line.startswith("DATABASE_URL="):
        if not replaced:
            updated.append(new_line)
            replaced = True
    else:
        updated.append(line)
if not replaced:
    updated.append(new_line)
temporary = env_path.with_suffix(".tmp")
temporary.write_text("\n".join(updated) + "\n")
temporary.chmod(0o600)
temporary.replace(env_path)
print("DATABASE_URL atualizada sem alterar as demais configurações.")
