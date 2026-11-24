"""Builds the encrypted schedule that /now/ shows.

Reads the private Google Calendar iCal feed (CAL_ICS_URL), keeps the timed
events from yesterday to 8 days ahead, and encrypts them with NOW_PASSWORD
(PBKDF2-SHA256 + AES-GCM) so the public repo never holds readable data.
Run by .github/workflows/now.yml.
"""
import datetime as dt, json, os, sys, urllib.request

import icalendar, recurring_ical_events
from now_crypto import encrypt

url, password, out = os.environ["CAL_ICS_URL"], os.environ["NOW_PASSWORD"], sys.argv[1]
with urllib.request.urlopen(url, timeout=60) as r:
    cal = icalendar.Calendar.from_ical(r.read())

now = dt.datetime.now(dt.timezone.utc)
events = []
for e in recurring_ical_events.of(cal).between(now - dt.timedelta(days=1), now + dt.timedelta(days=8)):
    start, end = e.get("DTSTART").dt, e.get("DTEND").dt if e.get("DTEND") else None
    if not isinstance(start, dt.datetime) or not isinstance(end, dt.datetime):
        continue  # skip all-day events
    if start.tzinfo is None:
        start, end = start.replace(tzinfo=dt.timezone.utc), end.replace(tzinfo=dt.timezone.utc)
    events.append({"t": str(e.get("SUMMARY", "Untitled")),
                   "s": int(start.timestamp() * 1000), "e": int(end.timestamp() * 1000)})
events.sort(key=lambda x: x["s"])

payload = {"built": int(now.timestamp() * 1000), "events": events}
# GOALS_TOKEN (optional) lets the page save goals; it travels inside the encrypted file only
if os.environ.get("GOALS_TOKEN"):
    payload["token"] = os.environ["GOALS_TOKEN"]
with open(out, "w") as f:
    # "built" is in the clear so a stale feed is easy to spot without the password
    json.dump(encrypt(payload, password, {"built": payload["built"]}), f)
print(f"{len(events)} events")
