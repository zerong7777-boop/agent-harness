from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke test runtime/app-server/bridge process lifecycle.")
    parser.add_argument("--root", default=str(ROOT), help="Control-plane root.")
    parser.add_argument("--task-id", required=True, help="Task id to use for the smoke.")
    parser.add_argument("--port", type=int, default=4381, help="Temporary control-plane port.")
    parser.add_argument("--send-message", action="store_true", help="Also send one real message through the attached thread.")
    return parser.parse_args()


def wait_for_http(url: str, timeout_seconds: float = 15.0) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1.5) as response:  # noqa: S310
                if int(response.status) == 200:
                    return
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
        time.sleep(0.4)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error}")


def post_json(base_url: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        f"{base_url}{path}",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=60) as response:  # noqa: S310
            body = response.read().decode("utf-8")
            parsed = json.loads(body)
            if not parsed.get("ok"):
                raise RuntimeError(parsed.get("error") or f"{path} failed")
            return parsed
    except Exception as exc:
        if hasattr(exc, "read"):
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{path} failed: {body}") from exc
        raise


def get_json(base_url: str, path: str) -> dict[str, Any]:
    with urlopen(f"{base_url}{path}", timeout=60) as response:  # noqa: S310
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    args = parse_args()
    root = Path(args.root).resolve()
    base_url = f"http://127.0.0.1:{args.port}"
    stdout_log = root / "tmp" / f"runtime-smoke-{args.port}.out.log"
    stderr_log = root / "tmp" / f"runtime-smoke-{args.port}.err.log"
    stdout_log.parent.mkdir(parents=True, exist_ok=True)

    server = subprocess.Popen(  # noqa: S603
        ["py", "-3", str(root / "scripts" / "control_plane_server.py"), "--root", str(root), "--port", str(args.port)],
        cwd=str(root),
        stdout=stdout_log.open("w", encoding="utf-8"),
        stderr=stderr_log.open("w", encoding="utf-8"),
        stdin=subprocess.DEVNULL,
    )

    try:
        wait_for_http(f"{base_url}/gui/")
        result: dict[str, Any] = {}
        result["probe"] = post_json(base_url, "/api/runtime/probe-app-server", {"task_id": args.task_id})
        result["attach"] = post_json(base_url, "/api/runtime/attach-app-server", {"task_id": args.task_id})
        if args.send_message:
            result["send_message"] = post_json(
                base_url,
                "/api/runtime/send-message",
                {
                    "task_id": args.task_id,
                    "message_kind": "user",
                    "sent_by": "smoke",
                    "content": "Reply with one short line that says runtime smoke reached the real app-server thread.",
                },
            )
        result["status_before_stop"] = get_json(base_url, f"/api/runtime/status?task_id={args.task_id}")
        result["events_before_stop"] = get_json(base_url, f"/api/runtime/events?task_id={args.task_id}")
        stop_result = post_json(base_url, "/api/runtime/stop-app-server", {"task_id": args.task_id})
        result["stop_app_server"] = stop_result
        result["status_after_stop"] = get_json(base_url, f"/api/runtime/status?task_id={args.task_id}")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        try:
            post_json(base_url, "/api/runtime/stop", {"task_id": args.task_id})
        except Exception:
            pass
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)


if __name__ == "__main__":
    try:
        main()
    except (URLError, RuntimeError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
