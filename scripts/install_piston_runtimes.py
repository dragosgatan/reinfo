import urllib.request
import json
import time

BASE = "http://piston:2000/api/v2"
NEEDED = {"c", "c++", "python", "go", "java", "kotlin", "rust", "javascript"}

pkgs = json.loads(urllib.request.urlopen(f"{BASE}/packages").read())
latest = {}
for p in pkgs:
    lang = p["language"]
    if lang in NEEDED:
        if lang not in latest or p["language_version"] > latest[lang]:
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
