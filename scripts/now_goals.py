"""Adds goals to the encrypted goals file shown on /now/.

Usage: NOW_PASSWORD=... GOALS_ADD='[{"t": "Goal", "d": "2026-12-31"}]' python now_goals.py goals.json
"d" (due date, YYYY-MM-DD) is optional. Run by .github/workflows/goals.yml.
The page itself can also add and remove goals once GOALS_TOKEN is set.
"""
import json, os, sys

from now_crypto import decrypt, encrypt

path, password = sys.argv[1], os.environ["NOW_PASSWORD"]
goals = decrypt(json.load(open(path)), password)["goals"] if os.path.exists(path) else []
for g in json.loads(os.environ.get("GOALS_ADD") or "[]"):
    goal = {"t": str(g["t"])}
    if g.get("d"):
        goal["d"] = str(g["d"])
    goals.append(goal)
with open(path, "w") as f:
    json.dump(encrypt({"goals": goals}, password), f)
print(f"{len(goals)} goals")
