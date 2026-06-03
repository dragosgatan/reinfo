import urllib.request
import json
import time

BASE = "http://piston:2000/api/v2"
NEEDED = {"gcc", "node", "python", "go", "java", "kotlin", "rust"}

def ver_tuple(v):
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)

pkgs = json.loads(urllib.request.urlopen(f"{BASE}/packages").read())
latest = {}
for p in pkgs:
    lang = p["language"]
    if lang in NEEDED:
        if lang not in latest or ver_tuple(p["language_version"]) > ver_tuple(latest[lang]):
            latest[lang] = p["language_version"]

print("Installing:", latest)
for lang, ver in latest.items():
    print(f"  {lang} {ver}...", end=" ", flush=True)
    req = urllib.request.Request(
        f"{BASE}/packages",
        data=json.dumps({"language": lang, "version": ver}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=180)
        print("OK")
    except Exception as e:
        print(f"FAILED: {e}")
    time.sleep(1)

print("\nInstalled runtimes:")
for r in json.loads(urllib.request.urlopen(f"{BASE}/runtimes").read()):
    print(f"  {r['language']} {r['version']}")
