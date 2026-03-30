from __future__ import annotations

import argparse
import json
import subprocess
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parent.parent
HOST = "127.0.0.1"
PORT = 4391
PROCESS_HANDLES: dict[str, subprocess.Popen[str]] = {}
PROCESS_META: dict[str, dict[str, Any]] = {}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="External runtime launcher for Codex app-server.")
    parser.add_argument("--host", default=HOST, help="Host to bind.")
    parser.add_argument("--port", type=int, default=PORT, help="Port to bind.")
    parser.add_argument("--root", default=str(ROOT), help="Control-plane root.")
    return parser.parse_args()


def app_server_urls(port: int) -> dict[str, str]:
    ws_url = f"ws://{HOST}:{port}"
    base_http = f"http://{HOST}:{port}"
    return {
        "ws_url": ws_url,
        "ready_url": f"{base_http}/readyz",
        "health_url": f"{base_http}/healthz",
    }


def runtime_log_paths(root: Path, task_id: str) -> tuple[Path, Path]:
    runtime_dir = root / "tasks" / task_id / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    return runtime_dir / "app-server.out.log", runtime_dir / "app-server.err.log"


def http_probe(url: str, timeout: float = 1.5) -> dict[str, Any]:
    try:
        with urlopen(url, timeout=timeout) as response:  # noqa: S310
            body = response.read().decode("utf-8", errors="replace")
            return {"ok": True, "status": int(response.status), "body": body}
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {"ok": False, "status": int(exc.code), "body": body, "error": str(exc)}
    except URLError as exc:
        return {"ok": False, "status": 0, "body": "", "error": str(exc.reason)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "status": 0, "body": "", "error": str(exc)}


def wait_for_app_server(ready_url: str, health_url: str, timeout_seconds: float = 10.0) -> tuple[bool, dict[str, Any], dict[str, Any]]:
    deadline = time.time() + timeout_seconds
    last_ready = {"ok": False, "status": 0, "body": "", "error": "probe not started"}
    last_health = {"ok": False, "status": 0, "body": "", "error": "probe not started"}
    while time.time() < deadline:
        last_ready = http_probe(ready_url)
        last_health = http_probe(health_url)
        if last_ready.get("ok") and last_health.get("ok"):
            return True, last_ready, last_health
        time.sleep(0.4)
    return False, last_ready, last_health


def stop_pid(pid: int) -> None:
    if pid <= 0:
        return
    subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def launch_app_server(root: Path, task_id: str, working_directory: str, port: int) -> dict[str, Any]:
    existing = PROCESS_HANDLES.get(task_id)
    if existing is not None and existing.poll() is None:
        raise ValueError("app-server is already active for this task")

    urls = app_server_urls(port)
    stdout_log, stderr_log = runtime_log_paths(root, task_id)
    command = [
        "powershell",
        "-NoProfile",
        "-Command",
        f"codex app-server --listen {urls['ws_url']}",
    ]
    with stdout_log.open("w", encoding="utf-8") as stdout_handle, stderr_log.open("w", encoding="utf-8") as stderr_handle:
        process = subprocess.Popen(  # noqa: S603
            command,
            cwd=working_directory,
            stdout=stdout_handle,
            stderr=stderr_handle,
            stdin=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
        )

    ready_ok, ready_result, health_result = wait_for_app_server(urls["ready_url"], urls["health_url"])
    if not ready_ok:
        stop_pid(int(process.pid))
        PROCESS_HANDLES.pop(task_id, None)
        PROCESS_META.pop(task_id, None)
        error_summary = ready_result.get("error") or health_result.get("error") or "readyz/healthz failed"
        raise RuntimeError(f"app-server probe failed: {error_summary}")

    PROCESS_HANDLES[task_id] = process
    PROCESS_META[task_id] = {
        "task_id": task_id,
        "pid": int(process.pid),
        "port": port,
        "working_directory": working_directory,
        "stdout_log": str(stdout_log),
        "stderr_log": str(stderr_log),
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        **urls,
    }
    return {
        **PROCESS_META[task_id],
        "ready_result": ready_result,
        "health_result": health_result,
    }


def stop_app_server(task_id: str) -> dict[str, Any]:
    process = PROCESS_HANDLES.pop(task_id, None)
    meta = PROCESS_META.pop(task_id, None) or {}
    pid = int(meta.get("pid") or (process.pid if process is not None else 0) or 0)
    stop_pid(pid)
    return {"task_id": task_id, "pid": pid, "stopped": True}


def get_status(task_id: str) -> dict[str, Any]:
    process = PROCESS_HANDLES.get(task_id)
    meta = PROCESS_META.get(task_id)
    if process is None or meta is None:
        return {"task_id": task_id, "status": "not-found", "pid": 0}
    if process.poll() is not None:
        PROCESS_HANDLES.pop(task_id, None)
        PROCESS_META.pop(task_id, None)
        return {"task_id": task_id, "status": "stopped", "pid": int(process.pid or 0)}
    ready_result = http_probe(str(meta["ready_url"]))
    health_result = http_probe(str(meta["health_url"]))
    return {
        **meta,
        "status": "ready" if ready_result.get("ok") and health_result.get("ok") else "error",
        "ready_result": ready_result,
        "health_result": health_result,
    }


class RuntimeLauncherHandler(BaseHTTPRequestHandler):
    launcher_root = ROOT

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self.respond_json({"ok": True, "service": "runtime-launcher"}, HTTPStatus.OK)
            return
        if self.path.startswith("/api/status"):
            task_id = self.path.split("task_id=", 1)[1] if "task_id=" in self.path else ""
            self.respond_json({"ok": True, **get_status(task_id)}, HTTPStatus.OK)
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown route")

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        try:
            if self.path == "/api/launch-app-server":
                result = launch_app_server(
                    self.launcher_root,
                    str(payload.get("task_id") or "").strip(),
                    str(payload.get("working_directory") or "").strip() or str(self.launcher_root),
                    int(payload.get("port") or 0),
                )
                self.respond_json({"ok": True, **result}, HTTPStatus.OK)
                return
            if self.path == "/api/stop-app-server":
                result = stop_app_server(str(payload.get("task_id") or "").strip())
                self.respond_json({"ok": True, **result}, HTTPStatus.OK)
                return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown route")

    def respond_json(self, payload: dict[str, Any], status: HTTPStatus) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    args = parse_args()
    RuntimeLauncherHandler.launcher_root = Path(args.root).resolve()
    server = ThreadingHTTPServer((args.host, args.port), RuntimeLauncherHandler)
    print(f"Runtime launcher listening on http://{args.host}:{args.port}/healthz")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for task_id in list(PROCESS_HANDLES.keys()):
            stop_app_server(task_id)
        server.server_close()


if __name__ == "__main__":
    main()
