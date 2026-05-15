"""
Простой smoke-test сервера — НЕ юнит-тесты.
Запускать после `python server.py` в другом окне.

    python test_server.py [host] [port]

Пример:
    python test_server.py 127.0.0.1 8000
    python test_server.py 192.168.1.42 8000
"""

from __future__ import annotations

import sys
import time

import httpx


def main(host: str, port: int) -> int:
    base = f"http://{host}:{port}"
    print(f"Smoke-testing {base}")

    # 1) /health — ждём пока модель загрузится (до 5 минут)
    print("Waiting for model to load...")
    for _ in range(60):
        try:
            r = httpx.get(f"{base}/health", timeout=5).json()
        except Exception as e:
            print(f"  (server not reachable yet: {e})")
            time.sleep(5)
            continue
        print(f"  status={r['status']} vram={r.get('vram_used_gb')}/{r.get('vram_total_gb')}")
        if r["status"] == "ok":
            break
        time.sleep(5)
    else:
        print("Model never loaded — aborting.")
        return 1

    # 2) /templates
    print("\nFetching templates...")
    r = httpx.get(f"{base}/templates").json()
    print(f"  {len(r['templates'])} templates available")

    # 3) /generate с одним вариантом
    print("\nGenerating 1 short SFX...")
    t0 = time.time()
    r = httpx.post(f"{base}/generate", json={
        "prompt": "soft cinematic whoosh",
        "duration": 0.5,
        "num_variations": 1,
    }, timeout=120).json()
    print(f"  done in {time.time()-t0:.1f}s")
    print(f"  generated: {[f['filename'] for f in r['files']]}")

    # 4) Скачиваем сгенерированный файл
    fname = r["files"][0]["filename"]
    print(f"\nDownloading {fname}...")
    audio = httpx.get(f"{base}/audio/{fname}").content
    print(f"  {len(audio)} bytes")
    with open(f"_test_{fname}", "wb") as f:
        f.write(audio)
    print(f"  saved to _test_{fname}")

    # 5) /library
    print("\nLibrary:")
    r = httpx.get(f"{base}/library", params={"limit": 5}).json()
    print(f"  total: {r['total']}, items: {len(r['items'])}")

    print("\n[OK] All smoke tests passed")
    return 0


if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    sys.exit(main(host, port))
