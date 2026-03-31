from __future__ import annotations

import argparse
import json
import re
import socket
import subprocess
import threading
import time
import unicodedata
import uuid
from queue import Queue
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from build_indexes import build_indexes as raw_build_indexes, parse_markdown_record as raw_parse_markdown_record


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PRIVATE_DATA_ROOT = REPO_ROOT.with_name("agent-harness-data")
ACTIVE_STAGES = ["clarification", "planning", "execution", "verification", "knowledge-review"]
APP_SERVER_HOST = "127.0.0.1"
APP_SERVER_BASE_PORT = 4210
APP_SERVER_PORT_LIMIT = 4300
RUNTIME_LAUNCHER_HOST = "127.0.0.1"
RUNTIME_LAUNCHER_PORT = 4391
APP_SERVER_CLIENT_SCRIPT = Path(__file__).resolve().with_name("app_server_client.mjs")
APP_SERVER_BRIDGE_SCRIPT = Path(__file__).resolve().with_name("app_server_bridge.mjs")
APP_SERVER_PROCESSES: dict[str, subprocess.Popen[str]] = {}
APP_SERVER_BRIDGES: dict[str, "AppServerBridgeHandle"] = {}
RECORD_IO_LOCK = threading.RLock()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the local control plane GUI and mutation APIs.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind.")
    parser.add_argument("--port", type=int, default=4173, help="Port to bind.")
    parser.add_argument("--repo-root", default=str(REPO_ROOT), help="Repository root for GUI and static assets.")
    parser.add_argument("--data-root", default=None, help="Data root for tasks, indexes, accounts, machines, and sessions.")
    parser.add_argument("--root", default=None, help="Deprecated alias for --data-root.")
    return parser.parse_args()


def get_default_data_root() -> Path:
    if DEFAULT_PRIVATE_DATA_ROOT.exists():
        return DEFAULT_PRIVATE_DATA_ROOT
    return REPO_ROOT


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def parse_markdown_record(path: Path) -> Any:
    with RECORD_IO_LOCK:
        return raw_parse_markdown_record(path)


def build_indexes(root: Path, *, asset_source_root: Path = REPO_ROOT) -> dict[str, Any]:
    return raw_build_indexes(root, asset_source_root=asset_source_root)


def current_date_stamp() -> str:
    return datetime.now().astimezone().strftime("%Y%m%d")


def dump_toml_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return "[" + ", ".join(dump_toml_value(item) for item in value) + "]"
    return json.dumps("" if value is None else str(value), ensure_ascii=False)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_value.lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return cleaned or "task"


def next_available_task_id(root: Path, base_slug: str) -> str:
    date_prefix = current_date_stamp()
    candidate = f"{date_prefix}-{base_slug}"
    if not (root / "tasks" / candidate).exists():
        return candidate

    counter = 2
    while True:
        candidate = f"{date_prefix}-{base_slug}-{counter}"
        if not (root / "tasks" / candidate).exists():
            return candidate
        counter += 1


def write_markdown_with_frontmatter(path: Path, data: dict[str, Any], body: str) -> None:
    frontmatter_lines = ["+++"]
    for key, value in data.items():
        frontmatter_lines.append(f"{key} = {dump_toml_value(value)}")
    frontmatter_lines.append("+++")
    text = "\n".join(frontmatter_lines) + "\n" + body.lstrip("\n")
    with RECORD_IO_LOCK:
        path.write_text(text, encoding="utf-8")


def find_task_path(root: Path, task_id: str) -> Path:
    task_path = root / "tasks" / task_id / "task.md"
    if not task_path.exists():
        raise FileNotFoundError(f"Task {task_id} was not found")
    return task_path


def find_decision_path(root: Path, task_id: str, decision_id: str) -> Path:
    decisions_dir = root / "tasks" / task_id / "decisions"
    if not decisions_dir.exists():
        raise FileNotFoundError(f"No decisions directory for task {task_id}")

    for path in sorted(decisions_dir.glob("*.md")):
        record = parse_markdown_record(path)
        if record.data.get("decision_id") == decision_id:
            return path
    raise FileNotFoundError(f"Decision {decision_id} was not found under task {task_id}")


def get_next_stage(stage: str) -> str | None:
    try:
        index = ACTIVE_STAGES.index(stage)
    except ValueError:
        return None
    if index >= len(ACTIVE_STAGES) - 1:
        return None
    return ACTIVE_STAGES[index + 1]


def list_stage_records(root: Path, task_id: str, folder: str, object_kind: str) -> list[Any]:
    folder_path = root / "tasks" / task_id / folder
    if not folder_path.exists():
        return []

    records: list[Any] = []
    for path in sorted(folder_path.glob("*.md")):
        record = parse_markdown_record(path)
        if record.data.get("object_kind") == object_kind:
            records.append(record)
    return records


def get_advance_gate_error(root: Path, task_id: str, current_stage: str) -> str | None:
    decisions = list_stage_records(root, task_id, "decisions", "decision")
    experiments = list_stage_records(root, task_id, "experiments", "experiment")
    findings = list_stage_records(root, task_id, "findings", "finding")
    plan_path = root / "tasks" / task_id / "plan.md"
    plan_record = parse_markdown_record(plan_path) if plan_path.exists() else None

    if current_stage == "clarification":
        has_pending_decision = any(
            record.data.get("status") == "pending" or record.data.get("needs_user_confirmation")
            for record in decisions
        )
        if has_pending_decision:
            return "clarification 阶段仍有待确认的决策项"
        return None

    if current_stage == "planning":
        if plan_record is None:
            return "planning 阶段缺少计划记录"
        if plan_record.data.get("status") != "approved":
            return "planning 阶段的计划还没有达到 approved 状态"
        return None

    if current_stage == "execution":
        has_executed_experiment = any(str(record.data.get("status") or "") != "planned" for record in experiments)
        if not has_executed_experiment:
            return "execution 阶段至少需要一条不是 planned 的实验记录"
        return None

    if current_stage == "verification":
        has_executed_experiment = any(str(record.data.get("status") or "") != "planned" for record in experiments)
        has_finding = len(findings) > 0
        if not has_executed_experiment and not has_finding:
            return "verification 阶段至少需要一条已执行实验或一条 finding 记录"
        return None

    if current_stage == "knowledge-review":
        return "knowledge-review 已是最后一个活跃阶段，后续应改为 completed 或 archived"

    return None


def next_phase_path(root: Path, task_id: str) -> tuple[Path, str, str]:
    phases_dir = root / "tasks" / task_id / "phases"
    phases_dir.mkdir(parents=True, exist_ok=True)

    max_index = 0
    for path in phases_dir.glob("phase-*.md"):
        match = re.match(r"phase-(\d+)\.md$", path.name)
        if match:
            max_index = max(max_index, int(match.group(1)))

    next_index = max_index + 1
    phase_id = f"phase-{next_index:02d}"
    title = f"阶段 {next_index:02d}"
    return phases_dir / f"{phase_id}.md", phase_id, title


def build_phase_body(title: str, stage: str) -> str:
    stage_focus = {
        "planning": "整理里程碑和依赖关系，确认任务如何正式开始。",
        "execution": "开始执行已确认的计划，并把证据、实验和关键结论写回任务中心。",
        "verification": "核对结果是否满足成功判据，并补齐证据链。",
        "knowledge-review": "筛选知识候选，决定哪些内容进入正式知识库。",
    }
    exit_criteria = {
        "planning": "当计划被确认后，这个阶段结束，任务可正式进入 `execution`。",
        "execution": "当核心执行动作完成，并已有足够证据支撑验证时，这个阶段结束。",
        "verification": "当成功判据与证据完成对齐后，这个阶段结束。",
        "knowledge-review": "当知识候选完成审核并写回正式记录后，这个阶段结束。",
    }

    focus = stage_focus.get(stage, f"推进到 `{stage}` 阶段并完成该阶段的核心工作。")
    done = exit_criteria.get(stage, "满足当前阶段的退出条件后，再推进到下一阶段。")

    return (
        f"# {title}\n\n"
        "## Focus\n\n"
        f"{focus}\n\n"
        "## Exit Criteria\n\n"
        f"{done}\n"
    )


def build_task_body(title: str, summary: str) -> str:
    return (
        f"# {title}\n\n"
        "## Goal\n\n"
        f"{summary}\n\n"
        "## Constraints\n\n"
        "- 待补充。\n\n"
        "## Success Criteria\n\n"
        "- 待补充。\n\n"
        "## Unknowns\n\n"
        "- 待补充。\n"
    )


def build_plan_body(title: str) -> str:
    return (
        f"# {title} 计划\n\n"
        "## Milestones\n\n"
        "- milestone: 澄清目标\n"
        "- milestone: 形成可执行计划\n"
        "- milestone: 推进执行与验证\n\n"
        "## Dependency Graph\n\n"
        "- node: collect-context\n"
        "- depends_on: []\n"
        "- node: execute-next-step\n"
        "- depends_on: [\"collect-context\"]\n"
    )


def build_task_memory_index_body(title: str, summary: str) -> str:
    return (
        f"# {title} Task Memory\n\n"
        "## Current Snapshot\n\n"
        f"{summary}\n\n"
        "## Navigation\n\n"
        "- state.md\n"
        "- decisions.md\n"
        "- evidence.md\n"
        "- open-loops.md\n"
        "- handoff.md\n"
        "- session-rollups.md\n"
        "- knowledge-links.md\n"
    )


def build_task_memory_block_body(title: str, guidance: str) -> str:
    return f"# {title}\n\n{guidance}\n"


def build_runtime_index_body(title: str) -> str:
    return (
        f"# {title} Runtime\n\n"
        "## Current Snapshot\n\n"
        "This file is the lightweight runtime entrypoint for GUI and future execution adapters.\n\n"
        "## Navigation\n\n"
        "- status.md\n"
        "- launch.md\n"
        "- history.md\n"
    )


def build_runtime_status_body(title: str) -> str:
    return (
        f"# {title} Runtime Status\n\n"
        "This file stores the current runtime snapshot in more detail than `index.md`.\n"
    )


def build_runtime_launch_body(title: str) -> str:
    return (
        f"# {title} Runtime Launch\n\n"
        "This file records launch inputs, adapter type, and the last launch result.\n"
    )


def build_runtime_history_body(title: str) -> str:
    return (
        f"# {title} Runtime History\n\n"
        "## Events\n\n"
    )


def build_session_index_body(title: str) -> str:
    return (
        f"# {title}\n\n"
        "## Current Session\n\n"
        "This is a task-scoped session record.\n"
    )


def build_session_cache_body(title: str) -> str:
    return f"# {title} Cache\n\nTemporary working memory for this session.\n"


def build_session_summary_body(title: str) -> str:
    return f"# {title} Summary\n\nDurable compact summary for this session.\n"


def build_session_handoff_body(title: str) -> str:
    return f"# {title} Handoff\n\nMinimum context needed to continue this session.\n"


def build_session_event_log_body(title: str) -> str:
    return f"# {title} Event Log\n\n## Events\n\n"


def build_session_attachments_body(title: str) -> str:
    return f"# {title} Attachments\n\nTracked attachment refs for this session.\n"


def append_bullet_event(body: str, line: str) -> str:
    stripped = body.rstrip()
    if not stripped:
        return f"- {line}\n"
    return stripped + f"\n- {line}\n"


def recommend_mode_for_stage(stage: str) -> str:
    return "execute" if stage == "execution" else "discuss"


def summarize_message(value: str, limit: int = 160) -> str:
    collapsed = " ".join(value.split())
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[: limit - 1] + "…"


def next_available_session_id(task_dir: Path) -> str:
    sessions_dir = task_dir / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    max_index = 0
    for path in sessions_dir.glob("session-*/index.md"):
        match = re.match(r"session-(\d+)$", path.parent.name)
        if match:
            max_index = max(max_index, int(match.group(1)))
    return f"session-{max_index + 1:02d}"


def runtime_log_paths(root: Path, task_id: str) -> tuple[Path, Path]:
    runtime_dir = find_task_path(root, task_id).parent / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    return runtime_dir / "app-server.out.log", runtime_dir / "app-server.err.log"


def bridge_log_paths(root: Path, task_id: str) -> tuple[Path, Path]:
    runtime_dir = find_task_path(root, task_id).parent / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    return runtime_dir / "app-server-bridge.out.log", runtime_dir / "app-server-bridge.err.log"


def is_port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def next_available_app_server_port(root: Path) -> int:
    claimed_ports: set[int] = set()
    for launch_path in sorted((root / "tasks").glob("*/runtime/launch.md")):
        try:
            record = parse_markdown_record(launch_path)
        except Exception:  # noqa: BLE001
            continue
        port = int(record.data.get("app_server_port") or 0)
        if port > 0:
            claimed_ports.add(port)

    for port in range(APP_SERVER_BASE_PORT, APP_SERVER_PORT_LIMIT):
        if port in claimed_ports:
            continue
        if is_port_available(APP_SERVER_HOST, port):
            return port
    raise RuntimeError("No available app-server port was found in the configured local range")


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


def wait_for_app_server(ready_url: str, health_url: str, timeout_seconds: float = 8.0) -> tuple[bool, dict[str, Any], dict[str, Any]]:
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


def app_server_urls(port: int) -> dict[str, str]:
    ws_url = f"ws://{APP_SERVER_HOST}:{port}"
    base_http = f"http://{APP_SERVER_HOST}:{port}"
    return {
        "ws_url": ws_url,
        "ready_url": f"{base_http}/readyz",
        "health_url": f"{base_http}/healthz",
    }


def runtime_launcher_base_url() -> str:
    return f"http://{RUNTIME_LAUNCHER_HOST}:{RUNTIME_LAUNCHER_PORT}"


def runtime_launcher_request(method: str, path: str, payload: dict[str, Any] | None = None, timeout: float = 20.0) -> dict[str, Any]:
    url = f"{runtime_launcher_base_url()}{path}"
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    request = urlopen  # satisfy lint for imported symbol use in helper below
    del request
    from urllib.request import Request

    req = Request(url, data=data, headers=headers, method=method)
    with urlopen(req, timeout=timeout) as response:  # noqa: S310
        body = response.read().decode("utf-8")
    parsed = json.loads(body or "{}")
    if not parsed.get("ok"):
        raise ValueError(parsed.get("error") or f"runtime launcher request failed: {path}")
    return parsed


def runtime_launcher_healthz() -> bool:
    try:
        response = http_probe(f"{runtime_launcher_base_url()}/healthz", timeout=1.0)
    except Exception:
        return False
    return bool(response.get("ok"))


def normalize_working_directory(root: Path, working_directory: str) -> str:
    candidate = Path(working_directory).expanduser() if working_directory else root
    resolved = candidate.resolve() if candidate.exists() else root.resolve()
    return str(resolved)


def launch_local_app_server(root: Path, task_id: str, working_directory: str, port: int) -> dict[str, Any]:
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
    APP_SERVER_PROCESSES[task_id] = process

    return {
        "pid": int(process.pid),
        "command": command,
        "stdout_log": str(stdout_log),
        "stderr_log": str(stderr_log),
        **urls,
    }


def run_app_server_client(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not APP_SERVER_CLIENT_SCRIPT.exists():
        raise FileNotFoundError(f"App-server client script was not found: {APP_SERVER_CLIENT_SCRIPT}")

    result = subprocess.run(  # noqa: S603
        ["node", str(APP_SERVER_CLIENT_SCRIPT), action],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=False,
        cwd=str(REPO_ROOT),
    )
    if result.returncode != 0:
        stderr = (result.stderr or result.stdout or "").strip()
        raise ValueError(stderr or f"app-server client failed for action {action}")

    try:
        return json.loads((result.stdout or "").strip() or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError(f"app-server client returned invalid JSON: {exc}") from exc


class AppServerBridgeHandle:
    def __init__(
        self,
        root: Path,
        task_id: str,
        session_id: str,
        process: subprocess.Popen[str],
        *,
        stdout_log_path: Path,
        stderr_log_path: Path,
    ) -> None:
        self.root = root
        self.task_id = task_id
        self.session_id = session_id
        self.process = process
        self.lock = threading.Lock()
        self.attached_queue: Queue[dict[str, Any]] = Queue()
        self.pending_commands: dict[str, Queue[dict[str, Any]]] = {}
        self.stdout_log_path = stdout_log_path
        self.stderr_log_path = stderr_log_path
        self.last_event_at = ""
        self._exit_notified = False
        self.reader = threading.Thread(target=self._read_stdout, daemon=True)
        self.stderr_reader = threading.Thread(target=self._read_stderr, daemon=True)
        self.reader.start()
        self.stderr_reader.start()

    @property
    def pid(self) -> int:
        return int(self.process.pid or 0)

    def is_running(self) -> bool:
        return self.process.poll() is None

    def _write_log_line(self, path: Path, line: str) -> None:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(line)

    def _read_stdout(self) -> None:
        assert self.process.stdout is not None
        for raw_line in self.process.stdout:
            self._write_log_line(self.stdout_log_path, raw_line)
            line = raw_line.strip()
            if not line:
                continue
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                continue
            self._handle_message(message)
        self._handle_process_exit("app-server bridge stdout closed")

    def _read_stderr(self) -> None:
        if self.process.stderr is None:
            return
        for raw_line in self.process.stderr:
            self._write_log_line(self.stderr_log_path, raw_line)

    def _handle_message(self, message: dict[str, Any]) -> None:
        message_type = str(message.get("type") or "")
        self.last_event_at = str(message.get("timestamp") or now_iso())
        if message_type == "attached":
            self.attached_queue.put(message)
            return
        if message_type == "event":
            append_app_server_events(self.root, self.task_id, self.session_id, [message])
            return
        if message_type == "command-result":
            request_id = str(message.get("requestId") or "")
            pending = self.pending_commands.pop(request_id, None)
            if pending is not None:
                pending.put(message)
            return
        if message_type == "bridge-error":
            append_app_server_events(
                self.root,
                self.task_id,
                self.session_id,
                [{"method": "bridge-error", "summary": str(message.get("error") or "bridge error")}],
            )

    def _handle_process_exit(self, reason: str) -> None:
        if self._exit_notified:
            return
        self._exit_notified = True
        timestamp = now_iso()
        self.last_event_at = timestamp
        append_app_server_events(
            self.root,
            self.task_id,
            self.session_id,
            [{"method": "bridge-closed", "summary": reason, "timestamp": timestamp}],
        )
        self.attached_queue.put({"type": "attach-error", "timestamp": timestamp, "error": reason})
        for request_id, pending in list(self.pending_commands.items()):
            pending.put(
                {
                    "type": "command-result",
                    "requestId": request_id,
                    "turnId": "",
                    "turnStatus": "failed",
                    "timestamp": timestamp,
                    "error": reason,
                }
            )
        self.pending_commands.clear()

    def wait_for_attach(self, timeout_seconds: float = 20.0) -> dict[str, Any]:
        try:
            result = self.attached_queue.get(timeout=timeout_seconds)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("app-server bridge did not emit an attach confirmation in time") from exc
        if result.get("type") == "attach-error":
            raise ValueError(str(result.get("error") or "app-server bridge exited before attach"))
        return result

    def send_turn(self, content: str, timeout_seconds: float = 120.0) -> dict[str, Any]:
        if self.process.poll() is not None:
            raise ValueError("app-server bridge process is not running")
        request_id = uuid.uuid4().hex
        queue: Queue[dict[str, Any]] = Queue()
        self.pending_commands[request_id] = queue
        command = json.dumps({"action": "send-turn", "requestId": request_id, "content": content}, ensure_ascii=False)
        with self.lock:
            assert self.process.stdin is not None
            self.process.stdin.write(command + "\n")
            self.process.stdin.flush()
        try:
            result = queue.get(timeout=timeout_seconds)
        except Exception as exc:  # noqa: BLE001
            self.pending_commands.pop(request_id, None)
            raise ValueError("app-server bridge did not finish the turn in time") from exc
        if result.get("error"):
            raise ValueError(str(result.get("error")))
        return result

    def shutdown(self) -> None:
        if self.process.poll() is not None:
            self._handle_process_exit("app-server bridge stopped")
            return
        try:
            with self.lock:
                assert self.process.stdin is not None
                self.process.stdin.write(json.dumps({"action": "shutdown"}) + "\n")
                self.process.stdin.flush()
        except Exception:  # noqa: BLE001
            pass
        try:
            self.process.wait(timeout=3)
        except Exception:  # noqa: BLE001
            self.process.kill()
        finally:
            self._handle_process_exit("app-server bridge stopped")


def ensure_runtime_scaffold(root: Path, task_id: str) -> dict[str, Path]:
    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)
    task_dir = task_path.parent
    runtime_dir = task_dir / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    timestamp = now_iso()
    account_id = str(task_record.data.get("assignee_account_id") or "")
    machine_ids = list(task_record.data.get("machine_ids") or [])
    machine_id = machine_ids[0] if machine_ids else ""

    file_map = {
        "index": runtime_dir / "index.md",
        "status": runtime_dir / "status.md",
        "launch": runtime_dir / "launch.md",
        "history": runtime_dir / "history.md",
    }

    if not file_map["index"].exists():
        write_markdown_with_frontmatter(
            file_map["index"],
            {
                "object_kind": "task-runtime-index",
                "title": f"{task_record.data.get('title', task_id)} Runtime",
                "task_id": task_id,
                "runtime_status": "idle",
                "primary_session_id": "",
                "session_status": "",
                "last_event_at": "",
                "last_user_action_at": "",
                "last_error_summary": "",
                "current_mode": recommend_mode_for_stage(str(task_record.data.get("stage") or "")),
                "current_focus": "",
                "runtime_adapter": "control-plane-stub",
                "app_server_probe_status": "not-probed",
                "app_server_process_owner": "none",
                "runtime_launcher_url": runtime_launcher_base_url(),
                "app_server_port": 0,
                "app_server_ws_url": "",
                "app_server_pid": 0,
                "app_server_last_probe_at": "",
                "app_server_attach_status": "not-attached",
                "app_server_thread_id": "",
                "app_server_last_attach_at": "",
                "app_server_bridge_status": "not-started",
                "app_server_bridge_pid": 0,
                "app_server_bridge_last_seen_at": "",
                "account_id": account_id,
                "machine_id": machine_id,
                "linked_task_ids": [task_id],
                "source_refs": [f"tasks/{task_id}/task.md"],
                "created_at": timestamp,
                "updated_at": timestamp,
            },
            build_runtime_index_body(str(task_record.data.get("title") or task_id)),
        )
    if not file_map["status"].exists():
        write_markdown_with_frontmatter(
            file_map["status"],
            {
                "object_kind": "task-runtime-status",
                "title": f"{task_record.data.get('title', task_id)} Runtime Status",
                "task_id": task_id,
                "runtime_status": "idle",
                "primary_session_id": "",
                "session_status": "",
                "waiting_for_user": False,
                "last_event_summary": "",
                "last_message_summary": "",
                "last_error_detail": "",
                "allowed_actions": ["start"],
                "current_mode": recommend_mode_for_stage(str(task_record.data.get("stage") or "")),
                "current_focus": "",
                "runtime_adapter": "control-plane-stub",
                "app_server_probe_status": "not-probed",
                "app_server_process_owner": "none",
                "runtime_launcher_url": runtime_launcher_base_url(),
                "app_server_ready": False,
                "app_server_healthy": False,
                "app_server_port": 0,
                "app_server_ws_url": "",
                "app_server_ready_url": "",
                "app_server_health_url": "",
                "app_server_pid": 0,
                "app_server_probe_error": "",
                "app_server_attach_status": "not-attached",
                "app_server_thread_id": "",
                "app_server_thread_path": "",
                "app_server_last_turn_id": "",
                "app_server_bridge_status": "not-started",
                "app_server_bridge_pid": 0,
                "app_server_bridge_last_seen_at": "",
                "app_server_bridge_error": "",
                "account_id": account_id,
                "machine_id": machine_id,
                "working_directory": "",
                "linked_task_ids": [task_id],
                "source_refs": [f"tasks/{task_id}/runtime/index.md"],
                "created_at": timestamp,
                "updated_at": timestamp,
            },
            build_runtime_status_body(str(task_record.data.get("title") or task_id)),
        )
    if not file_map["launch"].exists():
        write_markdown_with_frontmatter(
            file_map["launch"],
            {
                "object_kind": "task-runtime-launch",
                "title": f"{task_record.data.get('title', task_id)} Runtime Launch",
                "task_id": task_id,
                "runtime_adapter": "control-plane-stub",
                "app_server_process_owner": "none",
                "runtime_launcher_url": runtime_launcher_base_url(),
                "account_id": account_id,
                "machine_id": machine_id,
                "working_directory": "",
                "app_server_port": 0,
                "app_server_ws_url": "",
                "app_server_ready_url": "",
                "app_server_health_url": "",
                "app_server_pid": 0,
                "app_server_stdout_log": "",
                "app_server_stderr_log": "",
                "app_server_thread_id": "",
                "app_server_thread_path": "",
                "app_server_bridge_pid": 0,
                "app_server_bridge_stdout_log": "",
                "app_server_bridge_stderr_log": "",
                "last_probe_at": "",
                "last_probe_result": "",
                "last_attach_at": "",
                "last_bridge_started_at": "",
                "last_bridge_stopped_at": "",
                "last_stop_at": "",
                "last_started_at": "",
                "last_start_result": "",
                "last_started_session_id": "",
                "linked_task_ids": [task_id],
                "source_refs": [f"tasks/{task_id}/runtime/index.md"],
                "created_at": timestamp,
                "updated_at": timestamp,
            },
            build_runtime_launch_body(str(task_record.data.get("title") or task_id)),
        )
    if not file_map["history"].exists():
        write_markdown_with_frontmatter(
            file_map["history"],
            {
                "object_kind": "task-runtime-history",
                "title": f"{task_record.data.get('title', task_id)} Runtime History",
                "task_id": task_id,
                "event_count": 0,
                "last_event_at": "",
                "last_event_kind": "",
                "last_session_id": "",
                "linked_task_ids": [task_id],
                "source_refs": [f"tasks/{task_id}/runtime/index.md"],
                "created_at": timestamp,
                "updated_at": timestamp,
            },
            build_runtime_history_body(str(task_record.data.get("title") or task_id)),
        )
    return file_map


def append_runtime_history_event(root: Path, task_id: str, event_kind: str, session_id: str, summary: str) -> None:
    runtime_paths = ensure_runtime_scaffold(root, task_id)
    history_record = parse_markdown_record(runtime_paths["history"])
    timestamp = now_iso()
    history_record.data["event_count"] = int(history_record.data.get("event_count", 0) or 0) + 1
    history_record.data["last_event_at"] = timestamp
    history_record.data["last_event_kind"] = event_kind
    history_record.data["last_session_id"] = session_id
    history_record.data["updated_at"] = timestamp
    history_body = append_bullet_event(history_record.body, f"{timestamp} | {event_kind} | {session_id or '-'} | {summary}")
    write_markdown_with_frontmatter(runtime_paths["history"], history_record.data, history_body)


def update_task_memory_active_sessions(root: Path, task_id: str, session_ids: list[str]) -> None:
    memory_path = root / "tasks" / task_id / "memory" / "index.md"
    if not memory_path.exists():
        return
    memory_record = parse_markdown_record(memory_path)
    memory_record.data["active_session_ids"] = session_ids
    memory_record.data["updated_at"] = now_iso()
    write_markdown_with_frontmatter(memory_path, memory_record.data, memory_record.body)


def touch_task_updated_at(root: Path, task_id: str) -> None:
    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)
    task_record.data["updated_at"] = now_iso()
    write_markdown_with_frontmatter(task_path, task_record.data, task_record.body)


def create_session_scaffold(
    root: Path,
    task_id: str,
    session_id: str,
    *,
    title: str,
    account_id: str,
    machine_id: str,
    mode: str,
    current_focus: str,
    working_directory: str,
    runtime_role: str = "primary",
    is_current_primary: bool = True,
) -> Path:
    task_dir = find_task_path(root, task_id).parent
    session_dir = task_dir / "sessions" / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    timestamp = now_iso()

    write_markdown_with_frontmatter(
        session_dir / "index.md",
        {
            "object_kind": "session",
            "title": title,
            "session_id": session_id,
            "task_id": task_id,
            "status": "waiting-user",
            "mode": mode,
            "current_focus": current_focus,
            "started_at": timestamp,
            "ended_at": "",
            "last_event_at": timestamp,
            "last_rollup_at": "",
            "cache_retention_policy": "rotate-after-stage-review",
            "runtime_role": runtime_role,
            "is_current_primary": is_current_primary,
            "superseded_by_session_id": "",
            "account_id": account_id,
            "machine_id": machine_id,
            "working_directory": working_directory,
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/runtime/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_session_index_body(title),
    )
    write_markdown_with_frontmatter(
        session_dir / "cache.md",
        {
            "object_kind": "session-cache",
            "title": f"{title} Cache",
            "session_id": session_id,
            "task_id": task_id,
            "cache_scope": "working",
            "last_compacted_at": "",
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/sessions/{session_id}/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_session_cache_body(title),
    )
    write_markdown_with_frontmatter(
        session_dir / "summary.md",
        {
            "object_kind": "session-summary",
            "title": f"{title} Summary",
            "session_id": session_id,
            "task_id": task_id,
            "summary_kind": "runtime-primary",
            "covers_event_ids": [],
            "recommended_next_step": "Confirm the handoff packet or send the first user message.",
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/sessions/{session_id}/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_session_summary_body(title),
    )
    write_markdown_with_frontmatter(
        session_dir / "handoff.md",
        {
            "object_kind": "session-handoff",
            "title": f"{title} Handoff",
            "session_id": session_id,
            "task_id": task_id,
            "handoff_kind": "primary-session",
            "target_mode": mode,
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/sessions/{session_id}/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_session_handoff_body(title),
    )
    write_markdown_with_frontmatter(
        session_dir / "event-log.md",
        {
            "object_kind": "session-event-log",
            "title": f"{title} Event Log",
            "session_id": session_id,
            "task_id": task_id,
            "event_count": 0,
            "last_compacted_at": "",
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/sessions/{session_id}/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_session_event_log_body(title),
    )
    write_markdown_with_frontmatter(
        session_dir / "attachments-index.md",
        {
            "object_kind": "session-attachments-index",
            "title": f"{title} Attachments",
            "session_id": session_id,
            "task_id": task_id,
            "attachment_count": 0,
            "attachment_refs": [],
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/sessions/{session_id}/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_session_attachments_body(title),
    )
    return session_dir


def mark_session_superseded(root: Path, task_id: str, session_id: str, superseded_by: str) -> None:
    if not session_id:
        return
    session_path = root / "tasks" / task_id / "sessions" / session_id / "index.md"
    if not session_path.exists():
        return
    record = parse_markdown_record(session_path)
    record.data["is_current_primary"] = False
    record.data["superseded_by_session_id"] = superseded_by
    record.data["updated_at"] = now_iso()
    write_markdown_with_frontmatter(session_path, record.data, record.body)


def append_session_event(root: Path, task_id: str, session_id: str, direction: str, message_kind: str, summary: str) -> None:
    event_log_path = root / "tasks" / task_id / "sessions" / session_id / "event-log.md"
    session_index_path = root / "tasks" / task_id / "sessions" / session_id / "index.md"
    if not event_log_path.exists() or not session_index_path.exists():
        raise FileNotFoundError(f"Session {session_id} was not found under task {task_id}")

    timestamp = now_iso()
    event_record = parse_markdown_record(event_log_path)
    event_record.data["event_count"] = int(event_record.data.get("event_count", 0) or 0) + 1
    event_record.data["updated_at"] = timestamp
    event_body = append_bullet_event(event_record.body, f"{timestamp} | {direction} | {message_kind} | {summary}")
    write_markdown_with_frontmatter(event_log_path, event_record.data, event_body)

    session_record = parse_markdown_record(session_index_path)
    session_record.data["last_event_at"] = timestamp
    session_record.data["updated_at"] = timestamp
    if summary:
        session_record.data["current_focus"] = summarize_message(summary, 96)
    write_markdown_with_frontmatter(session_index_path, session_record.data, session_record.body)


def update_session_latest_assistant_reply(
    root: Path,
    task_id: str,
    session_id: str,
    *,
    text: str,
    timestamp: str,
    turn_id: str = "",
    phase: str = "",
) -> None:
    session_index_path = root / "tasks" / task_id / "sessions" / session_id / "index.md"
    if not session_index_path.exists():
        return
    session_record = parse_markdown_record(session_index_path)
    session_record.data["latest_assistant_text"] = text
    session_record.data["latest_assistant_at"] = timestamp
    if turn_id:
        session_record.data["latest_turn_id"] = turn_id
    if phase:
        session_record.data["latest_assistant_phase"] = phase
    session_record.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(session_index_path, session_record.data, session_record.body)


def update_session_latest_turn_status(
    root: Path,
    task_id: str,
    session_id: str,
    *,
    status: str,
    timestamp: str,
    turn_id: str = "",
) -> None:
    session_index_path = root / "tasks" / task_id / "sessions" / session_id / "index.md"
    if not session_index_path.exists():
        return
    session_record = parse_markdown_record(session_index_path)
    session_record.data["latest_turn_status"] = status
    session_record.data["latest_turn_completed_at"] = timestamp
    if turn_id:
        session_record.data["latest_turn_id"] = turn_id
    session_record.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(session_index_path, session_record.data, session_record.body)


def close_active_phase(root: Path, task_id: str, task_record: Any, timestamp: str) -> None:
    phases_dir = root / "tasks" / task_id / "phases"
    active_phase_id = str(task_record.data.get("active_phase_id") or "").strip()
    active_path: Path | None = None

    if active_phase_id:
        candidate = phases_dir / f"{active_phase_id}.md"
        if candidate.exists():
            active_path = candidate

    if active_path is None:
        for path in sorted(phases_dir.glob("*.md")):
            phase_record = parse_markdown_record(path)
            if phase_record.data.get("status") in {"open", "running"}:
                active_path = path
                break

    if active_path is None:
        return

    phase_record = parse_markdown_record(active_path)
    phase_record.data["status"] = "completed"
    phase_record.data["ended_at"] = timestamp
    phase_record.data["updated_at"] = timestamp
    tags = [value for value in list(phase_record.data.get("tags") or []) if value != "active"]
    phase_record.data["tags"] = tags
    write_markdown_with_frontmatter(active_path, phase_record.data, phase_record.body)


def update_task_after_decision(root: Path, task_id: str) -> None:
    task_path = root / "tasks" / task_id / "task.md"
    task_record = parse_markdown_record(task_path)
    decision_paths = sorted((root / "tasks" / task_id / "decisions").glob("*.md"))

    has_pending_user_decision = False
    for path in decision_paths:
        record = parse_markdown_record(path)
        if record.data.get("status") == "pending" or record.data.get("needs_user_confirmation"):
            has_pending_user_decision = True
            break

    blocker_kinds = list(task_record.data.get("blocker_kinds") or [])
    blocker_kinds = [value for value in blocker_kinds if value != "waiting-user-decision"]
    if has_pending_user_decision:
        blocker_kinds.append("waiting-user-decision")

    deduped: list[str] = []
    for value in blocker_kinds:
        if value not in deduped:
            deduped.append(value)

    task_record.data["blocker_kinds"] = deduped
    task_record.data["blocked"] = bool(deduped)
    task_record.data["updated_at"] = now_iso()
    write_markdown_with_frontmatter(task_path, task_record.data, task_record.body)


def confirm_decision(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    decision_id = str(payload.get("decision_id") or "").strip()
    selected_option = str(payload.get("selected_option") or "").strip()
    confirmed_by = str(payload.get("confirmed_by") or "").strip() or "user"

    if not task_id or not decision_id:
        raise ValueError("task_id and decision_id are required")
    if not selected_option:
        raise ValueError("selected_option is required")

    decision_path = find_decision_path(root, task_id, decision_id)
    decision_record = parse_markdown_record(decision_path)
    decision_record.data["status"] = "confirmed"
    decision_record.data["selected_option"] = selected_option
    decision_record.data["confirmed_by"] = confirmed_by
    decision_record.data["needs_user_confirmation"] = False
    decision_record.data["updated_at"] = now_iso()
    write_markdown_with_frontmatter(decision_path, decision_record.data, decision_record.body)

    update_task_after_decision(root, task_id)
    build_indexes(root)

    return {
      "ok": True,
      "task_id": task_id,
      "decision_id": decision_id,
      "selected_option": selected_option,
      "confirmed_by": confirmed_by,
    }


def advance_task_stage(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    advanced_by = str(payload.get("advanced_by") or "").strip() or "user"

    if not task_id:
        raise ValueError("task_id is required")

    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)

    if task_record.data.get("terminal_state"):
        raise ValueError("terminal tasks cannot be advanced")
    if task_record.data.get("blocked"):
        raise ValueError("blocked tasks cannot be advanced")
    if task_record.data.get("paused"):
        raise ValueError("paused tasks cannot be advanced")

    current_stage = str(task_record.data.get("stage") or "").strip()
    next_stage = get_next_stage(current_stage)
    if not next_stage:
        raise ValueError("no further active stage is available")

    gate_error = get_advance_gate_error(root, task_id, current_stage)
    if gate_error:
        raise ValueError(gate_error)

    timestamp = now_iso()
    close_active_phase(root, task_id, task_record, timestamp)

    phase_path, phase_id, title = next_phase_path(root, task_id)
    phase_data = {
        "object_kind": "phase",
        "title": title,
        "task_id": task_id,
        "phase_id": phase_id,
        "phase_kind": next_stage,
        "status": "open",
        "started_at": timestamp,
        "ended_at": "",
        "tags": ["active", f"advanced-by:{advanced_by}"],
        "linked_task_ids": [task_id],
        "source_refs": [],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    write_markdown_with_frontmatter(phase_path, phase_data, build_phase_body(title, next_stage))

    task_record.data["stage"] = next_stage
    task_record.data["active_phase_id"] = phase_id
    task_record.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(task_path, task_record.data, task_record.body)

    build_indexes(root)

    return {
        "ok": True,
        "task_id": task_id,
        "previous_stage": current_stage,
        "next_stage": next_stage,
        "phase_id": phase_id,
        "advanced_by": advanced_by,
    }


def create_task(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    title = str(payload.get("title") or "").strip()
    summary = str(payload.get("summary") or "").strip()
    short_name = str(payload.get("short_name") or "").strip()
    priority = str(payload.get("priority") or "").strip() or "P2"
    account_id = str(payload.get("account_id") or "").strip() or "codex-main"
    machine_id = str(payload.get("machine_id") or "").strip()

    if not title:
        raise ValueError("title is required")
    if not summary:
        raise ValueError("summary is required")

    slug_source = short_name or title
    task_id = next_available_task_id(root, slugify(slug_source))
    task_dir = root / "tasks" / task_id

    timestamp = now_iso()
    for folder in [
        "phases",
        "decisions",
        "experiments",
        "findings",
        "knowledge-candidates",
        "memory/history",
        "runtime",
        "sessions",
    ]:
        (task_dir / folder).mkdir(parents=True, exist_ok=True)

    task_data = {
        "object_kind": "task",
        "title": title,
        "task_id": task_id,
        "stage": "clarification",
        "terminal_state": "",
        "priority": priority,
        "paused": False,
        "blocked": False,
        "blocker_kinds": [],
        "active_phase_id": "phase-01",
        "assignee_account_id": account_id,
        "primary_repo": "",
        "supporting_repos": [],
        "machine_ids": [machine_id] if machine_id else [],
        "parent_task_id": "",
        "parent_plan_node_id": "",
        "success_criteria": [],
        "constraints": [],
        "unknowns": [],
        "tags": [],
        "linked_task_ids": [],
        "source_refs": [],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    write_markdown_with_frontmatter(task_dir / "task.md", task_data, build_task_body(title, summary))

    plan_data = {
        "object_kind": "plan",
        "title": f"{title} 计划",
        "task_id": task_id,
        "plan_version": "v1",
        "status": "approved",
        "tags": [],
        "linked_task_ids": [task_id],
        "source_refs": [],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    write_markdown_with_frontmatter(task_dir / "plan.md", plan_data, build_plan_body(title))

    phase_data = {
        "object_kind": "phase",
        "title": "阶段 01",
        "task_id": task_id,
        "phase_id": "phase-01",
        "phase_kind": "clarification",
        "status": "open",
        "started_at": timestamp,
        "ended_at": "",
        "tags": ["active"],
        "linked_task_ids": [task_id],
        "source_refs": [],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    write_markdown_with_frontmatter(task_dir / "phases" / "phase-01.md", phase_data, build_phase_body("阶段 01", "clarification"))

    memory_index_data = {
        "object_kind": "task-memory-index",
        "title": f"{title} Task Memory",
        "task_id": task_id,
        "current_stage": "clarification",
        "current_phase_id": "phase-01",
        "current_phase_kind": "clarification",
        "current_phase_status": "open",
        "current_blockers": [],
        "recommended_next_step": "Clarify goal, constraints, success criteria, and unknowns before starting execution.",
        "last_rollup_at": timestamp,
        "pending_decision_count": 0,
        "pending_verification_count": 0,
        "active_session_ids": [],
        "recent_experiment_ids": [],
        "recent_finding_ids": [],
        "recent_decision_ids": [],
        "tags": ["task-memory"],
        "linked_task_ids": [task_id],
        "source_refs": [f"tasks/{task_id}/task.md"],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    write_markdown_with_frontmatter(
        task_dir / "memory" / "index.md",
        memory_index_data,
        build_task_memory_index_body(title, summary),
    )

    memory_blocks = {
        "state.md": ("state", "Capture the current stage, phase, blockers, and active scope."),
        "decisions.md": ("decisions", "Record confirmed decisions and unresolved choices that still need review."),
        "evidence.md": ("evidence", "Link validated experiments, findings, and artifact references."),
        "open-loops.md": ("open-loops", "Track pending decisions, verification gaps, and unresolved questions."),
        "handoff.md": ("handoff", "Summarize the minimum context a future Codex session needs to continue."),
        "session-rollups.md": ("session-rollups", "Append compact rollups imported from session summaries."),
        "knowledge-links.md": ("knowledge-links", "Track accepted or candidate knowledge entries linked to this task."),
    }
    for file_name, (block_kind, guidance) in memory_blocks.items():
        write_markdown_with_frontmatter(
            task_dir / "memory" / file_name,
            {
                "object_kind": "task-memory-block",
                "title": f"{title} {block_kind}",
                "task_id": task_id,
                "block_kind": block_kind,
                "snapshot_at": timestamp,
                "source_session_ids": [],
                "tags": ["task-memory"],
                "linked_task_ids": [task_id],
                "source_refs": [f"tasks/{task_id}/memory/index.md"],
                "created_at": timestamp,
                "updated_at": timestamp,
            },
            build_task_memory_block_body(f"{title} {block_kind}", guidance),
        )

    runtime_index_data = {
        "object_kind": "task-runtime-index",
        "title": f"{title} Runtime",
        "task_id": task_id,
        "runtime_status": "idle",
        "primary_session_id": "",
        "session_status": "",
        "last_event_at": "",
        "last_user_action_at": "",
        "last_error_summary": "",
        "current_mode": recommend_mode_for_stage("clarification"),
        "current_focus": "",
        "runtime_adapter": "control-plane-stub",
        "app_server_probe_status": "not-probed",
        "app_server_process_owner": "none",
        "runtime_launcher_url": runtime_launcher_base_url(),
        "app_server_port": 0,
        "app_server_ws_url": "",
        "app_server_pid": 0,
        "app_server_last_probe_at": "",
        "app_server_attach_status": "not-attached",
        "app_server_thread_id": "",
        "app_server_last_attach_at": "",
        "app_server_bridge_status": "not-started",
        "app_server_bridge_pid": 0,
        "app_server_bridge_last_seen_at": "",
        "account_id": account_id,
        "machine_id": machine_id,
        "linked_task_ids": [task_id],
        "source_refs": [f"tasks/{task_id}/task.md"],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    write_markdown_with_frontmatter(
        task_dir / "runtime" / "index.md",
        runtime_index_data,
        build_runtime_index_body(title),
    )
    write_markdown_with_frontmatter(
        task_dir / "runtime" / "status.md",
        {
            "object_kind": "task-runtime-status",
            "title": f"{title} Runtime Status",
            "task_id": task_id,
            "runtime_status": "idle",
            "primary_session_id": "",
            "session_status": "",
            "waiting_for_user": False,
            "last_event_summary": "",
            "last_message_summary": "",
            "last_error_detail": "",
            "allowed_actions": ["start"],
            "current_mode": recommend_mode_for_stage("clarification"),
            "current_focus": "",
            "runtime_adapter": "control-plane-stub",
            "app_server_probe_status": "not-probed",
            "app_server_process_owner": "none",
            "runtime_launcher_url": runtime_launcher_base_url(),
            "app_server_ready": False,
            "app_server_healthy": False,
            "app_server_port": 0,
            "app_server_ws_url": "",
            "app_server_ready_url": "",
            "app_server_health_url": "",
            "app_server_pid": 0,
            "app_server_probe_error": "",
            "app_server_attach_status": "not-attached",
            "app_server_thread_id": "",
            "app_server_thread_path": "",
            "app_server_last_turn_id": "",
            "app_server_bridge_status": "not-started",
            "app_server_bridge_pid": 0,
            "app_server_bridge_last_seen_at": "",
            "app_server_bridge_error": "",
            "account_id": account_id,
            "machine_id": machine_id,
            "working_directory": "",
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/runtime/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_runtime_status_body(title),
    )
    write_markdown_with_frontmatter(
        task_dir / "runtime" / "launch.md",
        {
            "object_kind": "task-runtime-launch",
            "title": f"{title} Runtime Launch",
            "task_id": task_id,
            "runtime_adapter": "control-plane-stub",
            "app_server_process_owner": "none",
            "runtime_launcher_url": runtime_launcher_base_url(),
            "account_id": account_id,
            "machine_id": machine_id,
            "working_directory": "",
            "app_server_port": 0,
            "app_server_ws_url": "",
            "app_server_ready_url": "",
            "app_server_health_url": "",
            "app_server_pid": 0,
            "app_server_stdout_log": "",
            "app_server_stderr_log": "",
            "app_server_thread_id": "",
            "app_server_thread_path": "",
            "app_server_bridge_pid": 0,
            "app_server_bridge_stdout_log": "",
            "app_server_bridge_stderr_log": "",
            "last_probe_at": "",
            "last_probe_result": "",
            "last_attach_at": "",
            "last_bridge_started_at": "",
            "last_bridge_stopped_at": "",
            "last_stop_at": "",
            "last_started_at": "",
            "last_start_result": "",
            "last_started_session_id": "",
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/runtime/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_runtime_launch_body(title),
    )
    write_markdown_with_frontmatter(
        task_dir / "runtime" / "history.md",
        {
            "object_kind": "task-runtime-history",
            "title": f"{title} Runtime History",
            "task_id": task_id,
            "event_count": 0,
            "last_event_at": "",
            "last_event_kind": "",
            "last_session_id": "",
            "linked_task_ids": [task_id],
            "source_refs": [f"tasks/{task_id}/runtime/index.md"],
            "created_at": timestamp,
            "updated_at": timestamp,
        },
        build_runtime_history_body(title),
    )

    build_indexes(root)

    return {
        "ok": True,
        "task_id": task_id,
        "title": title,
        "stage": "clarification",
    }


def set_task_terminal_state(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    terminal_state = str(payload.get("terminal_state") or "").strip()
    updated_by = str(payload.get("updated_by") or "").strip() or "user"

    if not task_id:
        raise ValueError("task_id is required")
    if terminal_state not in {"", "archived", "completed", "cancelled"}:
        raise ValueError("invalid terminal_state")

    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)
    task_record.data["terminal_state"] = terminal_state
    task_record.data["updated_at"] = now_iso()
    write_markdown_with_frontmatter(task_path, task_record.data, task_record.body)
    build_indexes(root)

    return {
        "ok": True,
        "task_id": task_id,
        "terminal_state": terminal_state,
        "updated_by": updated_by,
    }


def load_runtime_records(root: Path, task_id: str) -> tuple[dict[str, Path], Any, Any, Any]:
    runtime_paths = ensure_runtime_scaffold(root, task_id)
    runtime_index = parse_markdown_record(runtime_paths["index"])
    runtime_status = parse_markdown_record(runtime_paths["status"])
    runtime_launch = parse_markdown_record(runtime_paths["launch"])
    return runtime_paths, runtime_index, runtime_status, runtime_launch


def set_bridge_runtime_fields(
    runtime_index: Any,
    runtime_status: Any,
    runtime_launch: Any,
    *,
    status: str,
    pid: int = 0,
    last_seen_at: str = "",
    stdout_log: str = "",
    stderr_log: str = "",
    error: str = "",
) -> None:
    runtime_index.data["app_server_bridge_status"] = status
    runtime_index.data["app_server_bridge_pid"] = pid
    runtime_index.data["app_server_bridge_last_seen_at"] = last_seen_at

    runtime_status.data["app_server_bridge_status"] = status
    runtime_status.data["app_server_bridge_pid"] = pid
    runtime_status.data["app_server_bridge_last_seen_at"] = last_seen_at
    runtime_status.data["app_server_bridge_error"] = error

    runtime_launch.data["app_server_bridge_pid"] = pid
    runtime_launch.data["app_server_bridge_stdout_log"] = stdout_log
    runtime_launch.data["app_server_bridge_stderr_log"] = stderr_log
    if status in {"starting", "running"}:
        runtime_launch.data["last_bridge_started_at"] = last_seen_at
    if status in {"stopped", "missing", "error", "not-started"}:
        runtime_launch.data["last_bridge_stopped_at"] = last_seen_at


def clear_app_server_attachment(runtime_index: Any, runtime_status: Any, runtime_launch: Any) -> None:
    runtime_index.data["app_server_attach_status"] = "not-attached"
    runtime_index.data["app_server_thread_id"] = ""
    runtime_index.data["app_server_last_attach_at"] = ""

    runtime_status.data["app_server_attach_status"] = "not-attached"
    runtime_status.data["app_server_thread_id"] = ""
    runtime_status.data["app_server_thread_path"] = ""
    runtime_status.data["app_server_last_turn_id"] = ""

    runtime_launch.data["app_server_thread_id"] = ""
    runtime_launch.data["app_server_thread_path"] = ""


def teardown_app_server_runtime(
    root: Path,
    task_id: str,
    runtime_index: Any,
    runtime_status: Any,
    runtime_launch: Any,
    *,
    timestamp: str,
    mark_probe_status: str,
    summary: str,
    error_detail: str = "",
) -> int:
    bridge = APP_SERVER_BRIDGES.pop(task_id, None)
    if bridge is not None:
        bridge.shutdown()

    process_handle = APP_SERVER_PROCESSES.pop(task_id, None)
    pid = int(runtime_launch.data.get("app_server_pid") or runtime_index.data.get("app_server_pid") or 0)
    if process_handle is not None:
        pid = int(process_handle.pid or pid or 0)
    if pid > 0:
        stop_pid(pid)

    runtime_index.data["app_server_probe_status"] = mark_probe_status
    runtime_index.data["app_server_process_owner"] = "none"
    runtime_index.data["app_server_pid"] = 0
    runtime_index.data["app_server_last_probe_at"] = timestamp
    runtime_index.data["last_error_summary"] = summarize_message(error_detail, 160) if error_detail else ""
    runtime_index.data["runtime_adapter"] = "control-plane-stub"

    runtime_status.data["app_server_probe_status"] = mark_probe_status
    runtime_status.data["app_server_process_owner"] = "none"
    runtime_status.data["app_server_ready"] = False
    runtime_status.data["app_server_healthy"] = False
    runtime_status.data["app_server_pid"] = 0
    runtime_status.data["app_server_probe_error"] = error_detail
    runtime_status.data["last_error_detail"] = error_detail
    runtime_status.data["last_event_summary"] = summary
    runtime_status.data["runtime_adapter"] = "control-plane-stub"

    runtime_launch.data["app_server_pid"] = 0
    runtime_launch.data["app_server_process_owner"] = "none"
    runtime_launch.data["last_stop_at"] = timestamp
    runtime_launch.data["last_probe_result"] = mark_probe_status if not error_detail else f"{mark_probe_status}:{error_detail}"
    runtime_launch.data["runtime_adapter"] = "control-plane-stub"

    clear_app_server_attachment(runtime_index, runtime_status, runtime_launch)
    set_bridge_runtime_fields(
        runtime_index,
        runtime_status,
        runtime_launch,
        status="stopped" if mark_probe_status == "stopped" else "error",
        pid=0,
        last_seen_at=timestamp,
        stdout_log=str(runtime_launch.data.get("app_server_bridge_stdout_log") or ""),
        stderr_log=str(runtime_launch.data.get("app_server_bridge_stderr_log") or ""),
        error=error_detail,
    )
    return pid


def reconcile_runtime_processes(root: Path, task_id: str) -> tuple[dict[str, Path], Any, Any, Any]:
    runtime_paths, runtime_index, runtime_status, runtime_launch = load_runtime_records(root, task_id)
    changed = False
    timestamp = now_iso()

    bridge = APP_SERVER_BRIDGES.get(task_id)
    if bridge is not None and not bridge.is_running():
        APP_SERVER_BRIDGES.pop(task_id, None)
        bridge.shutdown()
        bridge = None

    process_handle = APP_SERVER_PROCESSES.get(task_id)
    if process_handle is not None and process_handle.poll() is not None:
        APP_SERVER_PROCESSES.pop(task_id, None)
        process_handle = None

    app_server_pid = int(runtime_launch.data.get("app_server_pid") or runtime_index.data.get("app_server_pid") or 0)
    process_owner = str(runtime_launch.data.get("app_server_process_owner") or runtime_index.data.get("app_server_process_owner") or "none")
    app_server_alive = process_handle is not None and process_handle.poll() is None
    if process_owner == "launcher" and app_server_pid > 0 and runtime_launcher_healthz():
        try:
            launcher_status = runtime_launcher_request("GET", f"/api/status?task_id={task_id}", None, timeout=5.0)
            app_server_alive = str(launcher_status.get("status") or "") == "ready"
        except Exception:
            app_server_alive = False
    if not app_server_alive and app_server_pid > 0:
        ready_url = str(runtime_launch.data.get("app_server_ready_url") or runtime_status.data.get("app_server_ready_url") or "")
        health_url = str(runtime_launch.data.get("app_server_health_url") or runtime_status.data.get("app_server_health_url") or "")
        if ready_url and health_url:
            ready_result = http_probe(ready_url)
            health_result = http_probe(health_url)
            app_server_alive = bool(ready_result.get("ok") and health_result.get("ok"))

    if app_server_pid > 0 and not app_server_alive:
        teardown_app_server_runtime(
            root,
            task_id,
            runtime_index,
            runtime_status,
            runtime_launch,
            timestamp=timestamp,
            mark_probe_status="error",
            summary="Recorded app-server process is no longer running.",
            error_detail="Recorded app-server process exited or was terminated outside the control plane.",
        )
        if runtime_index.data.get("runtime_status") in {"running", "waiting-user"}:
            runtime_index.data["runtime_status"] = "error"
            runtime_index.data["session_status"] = "error"
            runtime_status.data["runtime_status"] = "error"
            runtime_status.data["session_status"] = "error"
            runtime_status.data["waiting_for_user"] = True
        changed = True
    else:
        recorded_bridge_pid = int(runtime_launch.data.get("app_server_bridge_pid") or runtime_index.data.get("app_server_bridge_pid") or 0)
        if bridge is not None:
            set_bridge_runtime_fields(
                runtime_index,
                runtime_status,
                runtime_launch,
                status="running",
                pid=bridge.pid,
                last_seen_at=bridge.last_event_at or timestamp,
                stdout_log=str(bridge.stdout_log_path),
                stderr_log=str(bridge.stderr_log_path),
            )
            changed = True
        elif recorded_bridge_pid > 0 or str(runtime_index.data.get("app_server_attach_status") or "") == "attached":
            clear_app_server_attachment(runtime_index, runtime_status, runtime_launch)
            set_bridge_runtime_fields(
                runtime_index,
                runtime_status,
                runtime_launch,
                status="missing" if app_server_alive else "stopped",
                pid=0,
                last_seen_at=timestamp,
                stdout_log=str(runtime_launch.data.get("app_server_bridge_stdout_log") or ""),
                stderr_log=str(runtime_launch.data.get("app_server_bridge_stderr_log") or ""),
                error="The control-plane bridge is not attached to a live process." if app_server_alive else "",
            )
            if app_server_alive and runtime_index.data.get("runtime_adapter") == "codex-app-server":
                runtime_index.data["runtime_adapter"] = "codex-app-server-probe"
                runtime_status.data["runtime_adapter"] = "codex-app-server-probe"
            changed = True

    if changed:
        runtime_index.data["updated_at"] = timestamp
        runtime_status.data["updated_at"] = timestamp
        runtime_launch.data["updated_at"] = timestamp
        write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
        write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
        write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    return runtime_paths, runtime_index, runtime_status, runtime_launch


def ensure_primary_runtime_session(
    root: Path,
    task_id: str,
    *,
    account_id: str,
    machine_id: str,
    working_directory: str,
    current_focus: str,
) -> str:
    runtime_paths, runtime_index, runtime_status, runtime_launch = load_runtime_records(root, task_id)
    primary_session_id = str(runtime_index.data.get("primary_session_id") or "").strip()
    if primary_session_id:
        return primary_session_id

    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)
    stage = str(task_record.data.get("stage") or "")
    current_mode = recommend_mode_for_stage(stage)
    new_session_id = next_available_session_id(task_path.parent)

    create_session_scaffold(
        root,
        task_id,
        new_session_id,
        title=f"{task_record.data.get('title', task_id)} {new_session_id}",
        account_id=account_id,
        machine_id=machine_id,
        mode=current_mode,
        current_focus=current_focus or "Awaiting app-server attach.",
        working_directory=working_directory,
    )

    timestamp = now_iso()
    runtime_index.data["runtime_status"] = "waiting-user"
    runtime_index.data["primary_session_id"] = new_session_id
    runtime_index.data["session_status"] = "waiting-user"
    runtime_index.data["last_event_at"] = timestamp
    runtime_index.data["last_error_summary"] = ""
    runtime_index.data["current_mode"] = current_mode
    runtime_index.data["current_focus"] = current_focus or "Awaiting app-server attach."
    runtime_index.data["account_id"] = account_id
    runtime_index.data["machine_id"] = machine_id
    runtime_index.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

    runtime_status.data["runtime_status"] = "waiting-user"
    runtime_status.data["primary_session_id"] = new_session_id
    runtime_status.data["session_status"] = "waiting-user"
    runtime_status.data["waiting_for_user"] = True
    runtime_status.data["current_mode"] = current_mode
    runtime_status.data["current_focus"] = runtime_index.data["current_focus"]
    runtime_status.data["last_error_detail"] = ""
    runtime_status.data["account_id"] = account_id
    runtime_status.data["machine_id"] = machine_id
    runtime_status.data["working_directory"] = working_directory
    runtime_status.data["last_event_summary"] = "Primary session prepared for app-server attach."
    runtime_status.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

    runtime_launch.data["account_id"] = account_id
    runtime_launch.data["machine_id"] = machine_id
    runtime_launch.data["working_directory"] = working_directory
    runtime_launch.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    update_task_memory_active_sessions(root, task_id, [new_session_id])
    touch_task_updated_at(root, task_id)
    append_runtime_history_event(root, task_id, "primary-session-prepared", new_session_id, "Prepared a primary session for app-server attach.")
    return new_session_id


def start_app_server_bridge(root: Path, task_id: str, session_id: str, *, ws_url: str, working_directory: str) -> AppServerBridgeHandle:
    if not APP_SERVER_BRIDGE_SCRIPT.exists():
        raise FileNotFoundError(f"App-server bridge script was not found: {APP_SERVER_BRIDGE_SCRIPT}")

    existing = APP_SERVER_BRIDGES.get(task_id)
    if existing is not None:
        existing.shutdown()
        APP_SERVER_BRIDGES.pop(task_id, None)

    options = {
        "wsUrl": ws_url,
        "cwd": working_directory,
        "developerInstructions": "You are attached from the control plane. Wait for handoff or user input and keep your work grounded in the current task.",
    }
    stdout_log_path, stderr_log_path = bridge_log_paths(root, task_id)
    process = subprocess.Popen(  # noqa: S603
        ["node", str(APP_SERVER_BRIDGE_SCRIPT), json.dumps(options, ensure_ascii=False)],
        cwd=str(REPO_ROOT),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    handle = AppServerBridgeHandle(
        root,
        task_id,
        session_id,
        process,
        stdout_log_path=stdout_log_path,
        stderr_log_path=stderr_log_path,
    )
    APP_SERVER_BRIDGES[task_id] = handle
    return handle


def probe_runtime_app_server(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    working_directory = str(payload.get("working_directory") or "").strip()
    if not task_id:
        raise ValueError("task_id is required")

    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)
    runtime_paths, runtime_index, runtime_status, runtime_launch = reconcile_runtime_processes(root, task_id)

    existing_pid = int(runtime_launch.data.get("app_server_pid") or 0)
    existing_status = str(runtime_index.data.get("app_server_probe_status") or "")
    if existing_pid > 0 and existing_status in {"starting", "ready"}:
        raise ValueError("app-server is already active for this task")

    effective_workdir = normalize_working_directory(
        root,
        working_directory
        or str(runtime_status.data.get("working_directory") or runtime_launch.data.get("working_directory") or ""),
    )
    effective_account = str(runtime_index.data.get("account_id") or task_record.data.get("assignee_account_id") or "")
    effective_machine = str(
        runtime_index.data.get("machine_id")
        or (list(task_record.data.get("machine_ids") or [""])[0] if list(task_record.data.get("machine_ids") or []) else "")
    )
    port = next_available_app_server_port(root)
    use_launcher = bool(payload.get("use_launcher", True))
    launch_info: dict[str, Any]
    owner = "direct"
    if use_launcher:
        if not runtime_launcher_healthz():
            raise ValueError(
                "runtime launcher is not available. Start it with `py -3 .\\scripts\\runtime_launcher.py` and retry."
            )
        launch_info = runtime_launcher_request(
            "POST",
            "/api/launch-app-server",
            {"task_id": task_id, "working_directory": effective_workdir, "port": port},
            timeout=30.0,
        )
        owner = "launcher"
    else:
        launch_info = launch_local_app_server(root, task_id, effective_workdir, port)
    timestamp = now_iso()

    runtime_index.data["runtime_adapter"] = "codex-app-server-probe"
    runtime_index.data["app_server_probe_status"] = "starting"
    runtime_index.data["app_server_process_owner"] = owner
    runtime_index.data["runtime_launcher_url"] = runtime_launcher_base_url()
    runtime_index.data["app_server_port"] = port
    runtime_index.data["app_server_ws_url"] = launch_info["ws_url"]
    runtime_index.data["app_server_pid"] = launch_info["pid"]
    runtime_index.data["app_server_last_probe_at"] = timestamp
    runtime_index.data["account_id"] = effective_account
    runtime_index.data["machine_id"] = effective_machine
    runtime_index.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

    runtime_status.data["runtime_adapter"] = "codex-app-server-probe"
    runtime_status.data["app_server_probe_status"] = "starting"
    runtime_status.data["app_server_process_owner"] = owner
    runtime_status.data["runtime_launcher_url"] = runtime_launcher_base_url()
    runtime_status.data["app_server_ready"] = False
    runtime_status.data["app_server_healthy"] = False
    runtime_status.data["app_server_port"] = port
    runtime_status.data["app_server_ws_url"] = launch_info["ws_url"]
    runtime_status.data["app_server_ready_url"] = launch_info["ready_url"]
    runtime_status.data["app_server_health_url"] = launch_info["health_url"]
    runtime_status.data["app_server_pid"] = launch_info["pid"]
    runtime_status.data["app_server_probe_error"] = ""
    runtime_status.data["account_id"] = effective_account
    runtime_status.data["machine_id"] = effective_machine
    runtime_status.data["working_directory"] = effective_workdir
    runtime_status.data["last_event_summary"] = "App-server probe started. Waiting for readyz/healthz."
    runtime_status.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

    runtime_launch.data["runtime_adapter"] = "codex-app-server-probe"
    runtime_launch.data["app_server_process_owner"] = owner
    runtime_launch.data["runtime_launcher_url"] = runtime_launcher_base_url()
    runtime_launch.data["account_id"] = effective_account
    runtime_launch.data["machine_id"] = effective_machine
    runtime_launch.data["working_directory"] = effective_workdir
    runtime_launch.data["app_server_port"] = port
    runtime_launch.data["app_server_ws_url"] = launch_info["ws_url"]
    runtime_launch.data["app_server_ready_url"] = launch_info["ready_url"]
    runtime_launch.data["app_server_health_url"] = launch_info["health_url"]
    runtime_launch.data["app_server_pid"] = launch_info["pid"]
    runtime_launch.data["app_server_stdout_log"] = launch_info["stdout_log"]
    runtime_launch.data["app_server_stderr_log"] = launch_info["stderr_log"]
    runtime_launch.data["last_probe_at"] = timestamp
    runtime_launch.data["last_probe_result"] = "starting"
    runtime_launch.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    append_runtime_history_event(
        root,
        task_id,
        "app-server-probe-start",
        str(runtime_index.data.get("primary_session_id") or ""),
        f"Started codex app-server probe on {launch_info['ws_url']} via {owner}.",
    )

    ready_ok, ready_result, health_result = wait_for_app_server(launch_info["ready_url"], launch_info["health_url"])
    probe_timestamp = now_iso()

    runtime_index = parse_markdown_record(runtime_paths["index"])
    runtime_status = parse_markdown_record(runtime_paths["status"])
    runtime_launch = parse_markdown_record(runtime_paths["launch"])

    if ready_ok:
        runtime_index.data["app_server_probe_status"] = "ready"
        runtime_index.data["app_server_last_probe_at"] = probe_timestamp
        runtime_index.data["last_event_at"] = probe_timestamp
        runtime_index.data["last_error_summary"] = ""
        runtime_index.data["updated_at"] = probe_timestamp
        write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

        runtime_status.data["app_server_probe_status"] = "ready"
        runtime_status.data["app_server_ready"] = True
        runtime_status.data["app_server_healthy"] = True
        runtime_status.data["app_server_probe_error"] = ""
        runtime_status.data["last_event_summary"] = "App-server probe succeeded. Local readyz/healthz are healthy."
        runtime_status.data["updated_at"] = probe_timestamp
        write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

        runtime_launch.data["last_probe_at"] = probe_timestamp
        runtime_launch.data["last_probe_result"] = "ready"
        runtime_launch.data["updated_at"] = probe_timestamp
        write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

        append_runtime_history_event(
            root,
            task_id,
            "app-server-probe-ready",
            str(runtime_index.data.get("primary_session_id") or ""),
            f"App-server probe is healthy on {launch_info['ws_url']} via {owner}.",
        )
        touch_task_updated_at(root, task_id)
        build_indexes(root)
        return {
            "ok": True,
            "task_id": task_id,
            "app_server_probe_status": "ready",
            "app_server_port": port,
            "app_server_ws_url": launch_info["ws_url"],
            "app_server_pid": launch_info["pid"],
            "ready_result": ready_result,
            "health_result": health_result,
        }

    stop_pid(launch_info["pid"])
    error_summary = (
        ready_result.get("error")
        or health_result.get("error")
        or f"ready={ready_result.get('status', 0)} health={health_result.get('status', 0)}"
    )

    runtime_index.data["app_server_probe_status"] = "error"
    runtime_index.data["app_server_last_probe_at"] = probe_timestamp
    runtime_index.data["last_error_summary"] = summarize_message(str(error_summary), 160)
    runtime_index.data["updated_at"] = probe_timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

    runtime_status.data["app_server_probe_status"] = "error"
    runtime_status.data["app_server_ready"] = False
    runtime_status.data["app_server_healthy"] = False
    runtime_status.data["app_server_probe_error"] = str(error_summary)
    runtime_status.data["last_error_detail"] = str(error_summary)
    runtime_status.data["last_event_summary"] = "App-server probe failed before readyz/healthz became healthy."
    runtime_status.data["updated_at"] = probe_timestamp
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

    runtime_launch.data["app_server_pid"] = 0
    runtime_launch.data["last_probe_at"] = probe_timestamp
    runtime_launch.data["last_probe_result"] = f"error:{error_summary}"
    runtime_launch.data["updated_at"] = probe_timestamp
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    append_runtime_history_event(
        root,
        task_id,
        "app-server-probe-error",
        str(runtime_index.data.get("primary_session_id") or ""),
        f"App-server probe failed: {error_summary}",
    )
    touch_task_updated_at(root, task_id)
    build_indexes(root)
    raise ValueError(f"app-server probe failed: {error_summary}")


def stop_runtime_app_server(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    if not task_id:
        raise ValueError("task_id is required")

    runtime_paths, runtime_index, runtime_status, runtime_launch = reconcile_runtime_processes(root, task_id)
    pid = int(runtime_launch.data.get("app_server_pid") or runtime_index.data.get("app_server_pid") or 0)
    bridge_pid = int(runtime_launch.data.get("app_server_bridge_pid") or runtime_index.data.get("app_server_bridge_pid") or 0)
    process_owner = str(runtime_launch.data.get("app_server_process_owner") or runtime_index.data.get("app_server_process_owner") or "none")
    if pid <= 0 and bridge_pid <= 0:
        raise ValueError("no app-server process is recorded for this task")

    timestamp = now_iso()
    if process_owner == "launcher" and runtime_launcher_healthz():
        try:
            runtime_launcher_request("POST", "/api/stop-app-server", {"task_id": task_id}, timeout=20.0)
        except Exception:
            pass
    stopped_pid = teardown_app_server_runtime(
        root,
        task_id,
        runtime_index,
        runtime_status,
        runtime_launch,
        timestamp=timestamp,
        mark_probe_status="stopped",
        summary="App-server probe process was stopped from the control plane.",
    )
    runtime_index.data["updated_at"] = timestamp
    runtime_status.data["updated_at"] = timestamp
    runtime_launch.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    append_runtime_history_event(
        root,
        task_id,
        "app-server-stop",
        str(runtime_index.data.get("primary_session_id") or ""),
        "Stopped the app-server probe process.",
    )
    touch_task_updated_at(root, task_id)
    build_indexes(root)
    return {"ok": True, "task_id": task_id, "app_server_probe_status": "stopped", "app_server_pid": stopped_pid}


def append_app_server_events(root: Path, task_id: str, session_id: str, events: list[dict[str, Any]]) -> None:
    for event in events:
        method = str(event.get("method") or "app-server")
        summary = summarize_message(str(event.get("summary") or method), 160)
        direction = "server"
        if method in {"attach", "client/attach", "client/send-turn"}:
            direction = "client"
        elif method in {"error", "turn/timeout", "client/parse-error"}:
            direction = "error"
        append_session_event(root, task_id, session_id, direction, method, summary)
        payload = event.get("payload") or {}
        params = payload.get("params") or {}
        timestamp = str(event.get("timestamp") or now_iso())
        if method == "item/completed":
            item = params.get("item") or {}
            if str(item.get("type") or "") == "agentMessage":
                text = str(item.get("text") or "").strip()
                if text:
                    update_session_latest_assistant_reply(
                        root,
                        task_id,
                        session_id,
                        text=text,
                        timestamp=timestamp,
                        turn_id=str(params.get("turnId") or ""),
                        phase=str(item.get("phase") or ""),
                    )
        elif method == "turn/completed":
            turn = params.get("turn") or {}
            update_session_latest_turn_status(
                root,
                task_id,
                session_id,
                status=str(turn.get("status") or ""),
                timestamp=timestamp,
                turn_id=str(turn.get("id") or ""),
            )


def attach_runtime_app_server(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    if not task_id:
        raise ValueError("task_id is required")

    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)
    runtime_paths, runtime_index, runtime_status, runtime_launch = reconcile_runtime_processes(root, task_id)
    if str(runtime_index.data.get("app_server_probe_status") or "") != "ready":
        raise ValueError("app-server probe is not ready for this task")
    if str(runtime_index.data.get("app_server_attach_status") or "") == "attached" and str(runtime_index.data.get("app_server_thread_id") or ""):
        raise ValueError("app-server is already attached to a primary session")

    effective_account = str(runtime_index.data.get("account_id") or task_record.data.get("assignee_account_id") or "")
    effective_machine = str(
        runtime_index.data.get("machine_id")
        or (list(task_record.data.get("machine_ids") or [""])[0] if list(task_record.data.get("machine_ids") or []) else "")
    )
    effective_workdir = normalize_working_directory(
        root,
        str(runtime_status.data.get("working_directory") or runtime_launch.data.get("working_directory") or ""),
    )
    primary_session_id = ensure_primary_runtime_session(
        root,
        task_id,
        account_id=effective_account,
        machine_id=effective_machine,
        working_directory=effective_workdir,
        current_focus=str(runtime_index.data.get("current_focus") or task_record.summary or ""),
    )
    runtime_paths, runtime_index, runtime_status, runtime_launch = load_runtime_records(root, task_id)

    bridge = start_app_server_bridge(
        root,
        task_id,
        primary_session_id,
        ws_url=str(runtime_index.data.get("app_server_ws_url") or runtime_launch.data.get("app_server_ws_url") or ""),
        working_directory=effective_workdir,
    )
    bridge_started_at = now_iso()
    set_bridge_runtime_fields(
        runtime_index,
        runtime_status,
        runtime_launch,
        status="starting",
        pid=bridge.pid,
        last_seen_at=bridge_started_at,
        stdout_log=str(bridge.stdout_log_path),
        stderr_log=str(bridge.stderr_log_path),
    )
    runtime_index.data["updated_at"] = bridge_started_at
    runtime_status.data["updated_at"] = bridge_started_at
    runtime_launch.data["updated_at"] = bridge_started_at
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)
    try:
        attached_message = bridge.wait_for_attach()
    except Exception as exc:
        APP_SERVER_BRIDGES.pop(task_id, None)
        bridge.shutdown()
        failed_at = now_iso()
        runtime_paths, runtime_index, runtime_status, runtime_launch = load_runtime_records(root, task_id)
        clear_app_server_attachment(runtime_index, runtime_status, runtime_launch)
        set_bridge_runtime_fields(
            runtime_index,
            runtime_status,
            runtime_launch,
            status="error",
            pid=0,
            last_seen_at=failed_at,
            stdout_log=str(runtime_launch.data.get("app_server_bridge_stdout_log") or ""),
            stderr_log=str(runtime_launch.data.get("app_server_bridge_stderr_log") or ""),
            error=str(exc),
        )
        runtime_index.data["last_error_summary"] = summarize_message(str(exc), 160)
        runtime_status.data["last_error_detail"] = str(exc)
        runtime_status.data["last_event_summary"] = "App-server bridge failed before attach completed."
        runtime_index.data["updated_at"] = failed_at
        runtime_status.data["updated_at"] = failed_at
        runtime_launch.data["updated_at"] = failed_at
        write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
        write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
        write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)
        raise
    thread = dict(attached_message.get("thread") or {})
    thread_id = str(thread.get("id") or "")
    if not thread_id:
        raise ValueError("app-server attach did not return a thread id")

    timestamp = now_iso()
    session_index_path = root / "tasks" / task_id / "sessions" / primary_session_id / "index.md"
    session_record = parse_markdown_record(session_index_path)
    session_record.data["status"] = "waiting-user"
    session_record.data["external_thread_id"] = thread_id
    session_record.data["external_thread_path"] = str(thread.get("path") or "")
    session_record.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(session_index_path, session_record.data, session_record.body)

    runtime_index.data["runtime_adapter"] = "codex-app-server"
    runtime_index.data["app_server_attach_status"] = "attached"
    runtime_index.data["app_server_thread_id"] = thread_id
    runtime_index.data["app_server_last_attach_at"] = timestamp
    runtime_index.data["runtime_status"] = "waiting-user"
    runtime_index.data["session_status"] = "waiting-user"
    runtime_index.data["last_event_at"] = timestamp
    runtime_index.data["last_error_summary"] = ""
    runtime_index.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

    runtime_status.data["runtime_adapter"] = "codex-app-server"
    runtime_status.data["app_server_attach_status"] = "attached"
    runtime_status.data["app_server_thread_id"] = thread_id
    runtime_status.data["app_server_thread_path"] = str(thread.get("path") or "")
    runtime_status.data["waiting_for_user"] = True
    runtime_status.data["runtime_status"] = "waiting-user"
    runtime_status.data["session_status"] = "waiting-user"
    runtime_status.data["last_event_summary"] = "App-server attached. The primary session now has a real Codex thread."
    runtime_status.data["last_error_detail"] = ""
    runtime_status.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

    runtime_launch.data["runtime_adapter"] = "codex-app-server"
    runtime_launch.data["app_server_thread_id"] = thread_id
    runtime_launch.data["app_server_thread_path"] = str(thread.get("path") or "")
    runtime_launch.data["last_attach_at"] = timestamp
    runtime_launch.data["updated_at"] = timestamp
    set_bridge_runtime_fields(
        runtime_index,
        runtime_status,
        runtime_launch,
        status="running",
        pid=bridge.pid,
        last_seen_at=bridge.last_event_at or timestamp,
        stdout_log=str(bridge.stdout_log_path),
        stderr_log=str(bridge.stderr_log_path),
    )
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    append_app_server_events(
        root,
        task_id,
        primary_session_id,
        [
            {
                "method": "app-server/attached",
                "summary": f"Attached thread {thread_id}",
            }
        ],
    )
    append_runtime_history_event(root, task_id, "app-server-attached", primary_session_id, f"Attached app-server thread {thread_id}.")
    touch_task_updated_at(root, task_id)
    build_indexes(root)
    return {
        "ok": True,
        "task_id": task_id,
        "primary_session_id": primary_session_id,
        "thread_id": thread_id,
        "attach_status": "attached",
    }


def start_runtime(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    account_id = str(payload.get("account_id") or "").strip()
    machine_id = str(payload.get("machine_id") or "").strip()
    working_directory = str(payload.get("working_directory") or "").strip()

    if not task_id:
        raise ValueError("task_id is required")

    task_path = find_task_path(root, task_id)
    task_record = parse_markdown_record(task_path)
    runtime_paths, runtime_index, runtime_status, runtime_launch = reconcile_runtime_processes(root, task_id)

    effective_account = account_id or str(runtime_index.data.get("account_id") or task_record.data.get("assignee_account_id") or "")
    effective_machine = machine_id or str(runtime_index.data.get("machine_id") or (list(task_record.data.get("machine_ids") or [""])[0] if list(task_record.data.get("machine_ids") or []) else ""))
    stage = str(task_record.data.get("stage") or "")
    current_mode = recommend_mode_for_stage(stage)
    current_focus = str(payload.get("current_focus") or runtime_index.data.get("current_focus") or task_record.summary or "").strip()
    new_session_id = next_available_session_id(task_path.parent)
    old_primary = str(runtime_index.data.get("primary_session_id") or "").strip()
    if old_primary:
        mark_session_superseded(root, task_id, old_primary, new_session_id)

    create_session_scaffold(
        root,
        task_id,
        new_session_id,
        title=f"{task_record.data.get('title', task_id)} {new_session_id}",
        account_id=effective_account,
        machine_id=effective_machine,
        mode=current_mode,
        current_focus=current_focus or "Awaiting the first handoff or user message.",
        working_directory=working_directory,
    )

    timestamp = now_iso()
    runtime_index.data["runtime_status"] = "waiting-user"
    runtime_index.data["primary_session_id"] = new_session_id
    runtime_index.data["session_status"] = "waiting-user"
    runtime_index.data["last_event_at"] = timestamp
    runtime_index.data["last_error_summary"] = ""
    runtime_index.data["current_mode"] = current_mode
    runtime_index.data["current_focus"] = current_focus or "Awaiting the first handoff or user message."
    runtime_index.data["account_id"] = effective_account
    runtime_index.data["machine_id"] = effective_machine
    runtime_index.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

    runtime_status.data["runtime_status"] = "waiting-user"
    runtime_status.data["primary_session_id"] = new_session_id
    runtime_status.data["session_status"] = "waiting-user"
    runtime_status.data["waiting_for_user"] = True
    runtime_status.data["last_event_summary"] = "Primary session started as an empty session. Waiting for handoff or user message."
    runtime_status.data["last_message_summary"] = ""
    runtime_status.data["last_error_detail"] = ""
    runtime_status.data["allowed_actions"] = ["stop", "reconnect", "send_message"]
    runtime_status.data["current_mode"] = current_mode
    runtime_status.data["current_focus"] = runtime_index.data["current_focus"]
    runtime_status.data["account_id"] = effective_account
    runtime_status.data["machine_id"] = effective_machine
    runtime_status.data["working_directory"] = working_directory
    runtime_status.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

    runtime_launch.data["account_id"] = effective_account
    runtime_launch.data["machine_id"] = effective_machine
    runtime_launch.data["working_directory"] = working_directory
    runtime_launch.data["last_started_at"] = timestamp
    runtime_launch.data["last_start_result"] = "created-empty-primary-session"
    runtime_launch.data["last_started_session_id"] = new_session_id
    runtime_launch.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    update_task_memory_active_sessions(root, task_id, [new_session_id])
    touch_task_updated_at(root, task_id)
    append_runtime_history_event(root, task_id, "start", new_session_id, "Started an empty primary session in the control-plane runtime stub.")
    build_indexes(root)

    return {
        "ok": True,
        "task_id": task_id,
        "runtime_status": "waiting-user",
        "primary_session_id": new_session_id,
    }


def stop_runtime(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    if not task_id:
        raise ValueError("task_id is required")

    runtime_paths, runtime_index, runtime_status, runtime_launch = reconcile_runtime_processes(root, task_id)
    primary_session_id = str(runtime_index.data.get("primary_session_id") or "").strip()
    if not primary_session_id:
        raise ValueError("no primary session is active")

    session_index_path = root / "tasks" / task_id / "sessions" / primary_session_id / "index.md"
    if session_index_path.exists():
        session_record = parse_markdown_record(session_index_path)
        session_record.data["status"] = "stopped"
        session_record.data["ended_at"] = now_iso()
        session_record.data["updated_at"] = session_record.data["ended_at"]
        write_markdown_with_frontmatter(session_index_path, session_record.data, session_record.body)

    timestamp = now_iso()
    teardown_app_server_runtime(
        root,
        task_id,
        runtime_index,
        runtime_status,
        runtime_launch,
        timestamp=timestamp,
        mark_probe_status="stopped",
        summary="Stopped all runtime-owned app-server and bridge processes from the control plane.",
    )
    runtime_index.data["runtime_status"] = "stopped"
    runtime_index.data["session_status"] = "stopped"
    runtime_index.data["last_event_at"] = timestamp
    runtime_index.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

    runtime_status.data["runtime_status"] = "stopped"
    runtime_status.data["session_status"] = "stopped"
    runtime_status.data["waiting_for_user"] = False
    runtime_status.data["last_event_summary"] = "Primary session and all runtime-owned background processes were stopped from the control plane."
    runtime_status.data["allowed_actions"] = ["start", "reconnect"]
    runtime_status.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
    runtime_launch.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

    update_task_memory_active_sessions(root, task_id, [])
    touch_task_updated_at(root, task_id)
    append_runtime_history_event(root, task_id, "stop", primary_session_id, "Stopped the current primary session.")
    build_indexes(root)
    return {"ok": True, "task_id": task_id, "runtime_status": "stopped", "primary_session_id": primary_session_id}


def reconnect_runtime(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    if not task_id:
        raise ValueError("task_id is required")

    runtime_paths, runtime_index, runtime_status, runtime_launch = reconcile_runtime_processes(root, task_id)
    primary_session_id = str(runtime_index.data.get("primary_session_id") or "").strip()
    if not primary_session_id:
        raise ValueError("no primary session is available to reconnect")

    session_index_path = root / "tasks" / task_id / "sessions" / primary_session_id / "index.md"
    if session_index_path.exists():
        session_record = parse_markdown_record(session_index_path)
        session_record.data["status"] = "waiting-user"
        session_record.data["is_current_primary"] = True
        session_record.data["updated_at"] = now_iso()
        write_markdown_with_frontmatter(session_index_path, session_record.data, session_record.body)

    timestamp = now_iso()
    runtime_index.data["runtime_status"] = "waiting-user"
    runtime_index.data["session_status"] = "waiting-user"
    runtime_index.data["last_event_at"] = timestamp
    runtime_index.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

    runtime_status.data["runtime_status"] = "waiting-user"
    runtime_status.data["session_status"] = "waiting-user"
    runtime_status.data["waiting_for_user"] = True
    runtime_status.data["last_event_summary"] = "Primary session was reconnected in the control plane."
    runtime_status.data["last_error_detail"] = ""
    runtime_status.data["allowed_actions"] = ["stop", "send_message"]
    runtime_status.data["updated_at"] = timestamp
    write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

    update_task_memory_active_sessions(root, task_id, [primary_session_id])
    touch_task_updated_at(root, task_id)
    append_runtime_history_event(root, task_id, "reconnect", primary_session_id, "Reconnected the current primary session.")
    build_indexes(root)
    return {"ok": True, "task_id": task_id, "runtime_status": "waiting-user", "primary_session_id": primary_session_id}


def send_runtime_message(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    task_id = str(payload.get("task_id") or "").strip()
    message_kind = str(payload.get("message_kind") or "").strip() or "user"
    content = str(payload.get("content") or "").strip()
    sent_by = str(payload.get("sent_by") or "").strip() or "user"
    if not task_id:
        raise ValueError("task_id is required")
    if not content:
        raise ValueError("content is required")

    runtime_paths, runtime_index, runtime_status, runtime_launch = reconcile_runtime_processes(root, task_id)
    primary_session_id = str(runtime_index.data.get("primary_session_id") or "").strip()
    if not primary_session_id:
        raise ValueError("no primary session is active")

    attached_thread_id = str(
        runtime_status.data.get("app_server_thread_id")
        or runtime_index.data.get("app_server_thread_id")
        or ""
    ).strip()
    attached_thread_path = str(
        runtime_status.data.get("app_server_thread_path")
        or runtime_launch.data.get("app_server_thread_path")
        or ""
    ).strip()
    app_server_status = str(runtime_index.data.get("app_server_probe_status") or "").strip()

    bridge = APP_SERVER_BRIDGES.get(task_id)
    if (
        not attached_thread_id
        or app_server_status != "ready"
        or bridge is None
        or not bridge.is_running()
    ):
        reason_bits: list[str] = []
        if not attached_thread_id:
            reason_bits.append("real thread is not attached")
        if app_server_status != "ready":
            reason_bits.append(f"app-server probe status is {app_server_status or 'unknown'}")
        if bridge is None or not bridge.is_running():
            reason_bits.append("bridge is not running")
        raise ValueError(f"real Codex session is not available: {', '.join(reason_bits)}")

    timestamp = now_iso()
    summary = summarize_message(content)
    append_session_event(root, task_id, primary_session_id, sent_by, message_kind, summary)

    if attached_thread_id and app_server_status == "ready":
        runtime_index.data["runtime_status"] = "running"
        runtime_index.data["session_status"] = "running"
        runtime_index.data["last_event_at"] = timestamp
        runtime_index.data["last_user_action_at"] = timestamp
        runtime_index.data["current_focus"] = summary
        runtime_index.data["updated_at"] = timestamp
        write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

        runtime_status.data["runtime_status"] = "running"
        runtime_status.data["session_status"] = "running"
        runtime_status.data["waiting_for_user"] = False
        runtime_status.data["last_event_summary"] = "Forwarding the message to the attached app-server thread."
        runtime_status.data["last_message_summary"] = summary
        runtime_status.data["current_focus"] = summary
        runtime_status.data["updated_at"] = timestamp
        write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)

        try:
            bridge_result = bridge.send_turn(content)
        except Exception as exc:  # noqa: BLE001
            error_timestamp = now_iso()
            runtime_index = parse_markdown_record(runtime_paths["index"])
            runtime_status = parse_markdown_record(runtime_paths["status"])
            runtime_index.data["runtime_status"] = "error"
            runtime_index.data["session_status"] = "error"
            runtime_index.data["last_event_at"] = error_timestamp
            runtime_index.data["last_error_summary"] = summarize_message(str(exc), 160)
            runtime_index.data["updated_at"] = error_timestamp
            write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

            runtime_status.data["runtime_status"] = "error"
            runtime_status.data["session_status"] = "error"
            runtime_status.data["waiting_for_user"] = True
            runtime_status.data["last_error_detail"] = str(exc)
            runtime_status.data["last_event_summary"] = "Attached app-server turn failed."
            set_bridge_runtime_fields(
                runtime_index,
                runtime_status,
                runtime_launch,
                status="error",
                pid=0,
                last_seen_at=error_timestamp,
                stdout_log=str(runtime_launch.data.get("app_server_bridge_stdout_log") or ""),
                stderr_log=str(runtime_launch.data.get("app_server_bridge_stderr_log") or ""),
                error=str(exc),
            )
            runtime_launch.data["updated_at"] = error_timestamp
            runtime_status.data["updated_at"] = error_timestamp
            write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
            write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
            write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

            append_runtime_history_event(
                root,
                task_id,
                "app-server-turn-error",
                primary_session_id,
                f"{message_kind}:{summary}",
            )
            touch_task_updated_at(root, task_id)
            build_indexes(root)
            raise

        event_timestamp = now_iso()

        runtime_index = parse_markdown_record(runtime_paths["index"])
        runtime_status = parse_markdown_record(runtime_paths["status"])
        runtime_index.data["runtime_status"] = "waiting-user"
        runtime_index.data["session_status"] = "waiting-user"
        runtime_index.data["last_event_at"] = event_timestamp
        runtime_index.data["last_user_action_at"] = timestamp
        runtime_index.data["last_error_summary"] = ""
        runtime_index.data["current_focus"] = summary
        runtime_index.data["updated_at"] = event_timestamp
        write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)

        runtime_status.data["runtime_status"] = "waiting-user"
        runtime_status.data["session_status"] = "waiting-user"
        runtime_status.data["waiting_for_user"] = True
        runtime_status.data["last_event_summary"] = f"App-server turn finished with status {bridge_result.get('turnStatus', 'unknown')}."
        runtime_status.data["last_message_summary"] = summary
        runtime_status.data["current_focus"] = summary
        runtime_status.data["app_server_last_turn_id"] = str(bridge_result.get("turnId") or "")
        runtime_status.data["last_error_detail"] = ""
        runtime_status.data["updated_at"] = event_timestamp
        set_bridge_runtime_fields(
            runtime_index,
            runtime_status,
            runtime_launch,
            status="running",
            pid=bridge.pid if bridge.is_running() else 0,
            last_seen_at=bridge.last_event_at or event_timestamp,
            stdout_log=str(bridge.stdout_log_path),
            stderr_log=str(bridge.stderr_log_path),
        )
        write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
        write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
        runtime_launch.data["updated_at"] = event_timestamp
        write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)

        append_runtime_history_event(
            root,
            task_id,
            "app-server-turn",
            primary_session_id,
            f"{message_kind}:{summary}",
        )
        touch_task_updated_at(root, task_id)
        build_indexes(root)
        return {
            "ok": True,
            "task_id": task_id,
            "primary_session_id": primary_session_id,
            "message_kind": message_kind,
            "runtime_status": "waiting-user",
            "thread_id": attached_thread_id,
            "turn_id": bridge_result.get("turnId", ""),
            "turn_status": bridge_result.get("turnStatus", ""),
        }

    raise ValueError("real Codex session is not available")


def get_runtime_status(root: Path, task_id: str) -> dict[str, Any]:
    if not task_id:
        raise ValueError("task_id is required")
    reconcile_runtime_processes(root, task_id)
    build_indexes(root)
    detail_path = root / "indexes" / "runtime-details" / f"{task_id}.json"
    if not detail_path.exists():
        build_indexes(root)
    if not detail_path.exists():
        raise FileNotFoundError(f"Runtime detail for task {task_id} was not found")
    return json.loads(detail_path.read_text(encoding="utf-8"))


def get_runtime_events(root: Path, task_id: str) -> dict[str, Any]:
    reconcile_runtime_processes(root, task_id)
    build_indexes(root)
    detail = get_runtime_status(root, task_id)
    runtime_history = ((detail.get("runtime") or {}).get("history") or {})
    sessions = detail.get("sessions") or []
    session_events: list[dict[str, Any]] = []
    for session in sessions:
        for event in (session.get("event_log") or {}).get("events", []):
            session_events.append(
                {
                    "session_id": (session.get("session") or {}).get("session_id", ""),
                    **event,
                }
            )
    session_events.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return {
        "ok": True,
        "task_id": task_id,
        "runtime_events": runtime_history.get("events", []),
        "session_events": session_events,
    }


def reconcile_all_runtime_processes(root: Path) -> None:
    task_root = root / "tasks"
    if not task_root.exists():
        return
    for task_path in sorted(task_root.glob("*/task.md")):
        task_id = task_path.parent.name
        try:
            reconcile_runtime_processes(root, task_id)
        except Exception:
            continue


def shutdown_all_runtime_processes(root: Path) -> None:
    task_root = root / "tasks"
    if not task_root.exists():
        return
    timestamp = now_iso()
    for task_path in sorted(task_root.glob("*/task.md")):
        task_id = task_path.parent.name
        try:
            runtime_paths, runtime_index, runtime_status, runtime_launch = load_runtime_records(root, task_id)
        except Exception:
            continue
        pid = int(runtime_launch.data.get("app_server_pid") or runtime_index.data.get("app_server_pid") or 0)
        bridge = APP_SERVER_BRIDGES.pop(task_id, None)
        if bridge is None and pid <= 0:
            continue
        if bridge is not None:
            bridge.shutdown()
        teardown_app_server_runtime(
            root,
            task_id,
            runtime_index,
            runtime_status,
            runtime_launch,
            timestamp=timestamp,
            mark_probe_status="stopped",
            summary="Stopped app-server and bridge because the control-plane server is shutting down.",
        )
        runtime_index.data["updated_at"] = timestamp
        runtime_status.data["updated_at"] = timestamp
        runtime_launch.data["updated_at"] = timestamp
        write_markdown_with_frontmatter(runtime_paths["index"], runtime_index.data, runtime_index.body)
        write_markdown_with_frontmatter(runtime_paths["status"], runtime_status.data, runtime_status.body)
        write_markdown_with_frontmatter(runtime_paths["launch"], runtime_launch.data, runtime_launch.body)
    APP_SERVER_PROCESSES.clear()


class ControlPlaneHandler(SimpleHTTPRequestHandler):
    def __init__(
        self,
        *args: Any,
        directory: str | None = None,
        repo_root: Path | None = None,
        data_root: Path | None = None,
        **kwargs: Any,
    ) -> None:
        self.repo_root = repo_root or REPO_ROOT
        self.data_root = data_root or self.repo_root
        super().__init__(*args, directory=str(directory or self.repo_root), **kwargs)

    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        request_path = unquote(parsed.path)
        dist_root = self.repo_root / "gui" / "dist"
        data_indexes_root = self.data_root / "indexes"

        if dist_root.exists() and request_path.startswith("/gui"):
            relative_path = request_path.removeprefix("/gui").lstrip("/")
            candidate = (dist_root / relative_path).resolve() if relative_path else dist_root.resolve()

            if candidate.is_dir():
                candidate = candidate / "index.html"
            elif not candidate.exists() and "." not in Path(relative_path).name:
                candidate = dist_root / "index.html"

            try:
                candidate.relative_to(dist_root.resolve())
            except ValueError:
                return str((dist_root / "index.html").resolve())
            return str(candidate)

        if request_path == "/indexes" or request_path.startswith("/indexes/"):
            relative_path = request_path.removeprefix("/indexes").lstrip("/")
            candidate = (data_indexes_root / relative_path).resolve() if relative_path else data_indexes_root.resolve()
            if candidate.is_dir():
                candidate = candidate / "overview.json"
            try:
                candidate.relative_to(data_indexes_root.resolve())
            except ValueError:
                return str((data_indexes_root / "overview.json").resolve())
            return str(candidate)

        return super().translate_path(path)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/runtime/status":
            self.handle_get_runtime_status(parsed.query)
            return
        if parsed.path == "/api/runtime/events":
            self.handle_get_runtime_events(parsed.query)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/tasks/create":
            self.handle_create_task()
            return
        if parsed.path == "/api/decisions/confirm":
            self.handle_confirm_decision()
            return
        if parsed.path == "/api/tasks/advance-stage":
            self.handle_advance_task_stage()
            return
        if parsed.path == "/api/tasks/set-terminal-state":
            self.handle_set_task_terminal_state()
            return
        if parsed.path == "/api/runtime/start":
            self.handle_start_runtime()
            return
        if parsed.path == "/api/runtime/probe-app-server":
            self.handle_probe_runtime_app_server()
            return
        if parsed.path == "/api/runtime/attach-app-server":
            self.handle_attach_runtime_app_server()
            return
        if parsed.path == "/api/runtime/stop-app-server":
            self.handle_stop_runtime_app_server()
            return
        if parsed.path == "/api/runtime/stop":
            self.handle_stop_runtime()
            return
        if parsed.path == "/api/runtime/reconnect":
            self.handle_reconnect_runtime()
            return
        if parsed.path == "/api/runtime/send-message":
            self.handle_send_runtime_message()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown API route")

    def handle_get_runtime_status(self, query: str) -> None:
        try:
            params = parse_qs(query)
            task_id = (params.get("task_id") or [""])[0]
            result = get_runtime_status(self.data_root, task_id)
        except FileNotFoundError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.NOT_FOUND)
            return
        except ValueError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        self.respond_json({"ok": True, **result}, HTTPStatus.OK)

    def handle_get_runtime_events(self, query: str) -> None:
        try:
            params = parse_qs(query)
            task_id = (params.get("task_id") or [""])[0]
            result = get_runtime_events(self.data_root, task_id)
        except FileNotFoundError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.NOT_FOUND)
            return
        except ValueError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        self.respond_json(result, HTTPStatus.OK)

    def handle_confirm_decision(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length)
            payload = json.loads(raw_body.decode("utf-8"))
            result = confirm_decision(self.data_root, payload)
        except FileNotFoundError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.NOT_FOUND)
            return
        except ValueError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        except json.JSONDecodeError as exc:
            self.respond_json({"ok": False, "error": f"Invalid JSON: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.respond_json(result, HTTPStatus.OK)

    def handle_advance_task_stage(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length)
            payload = json.loads(raw_body.decode("utf-8"))
            result = advance_task_stage(self.data_root, payload)
        except FileNotFoundError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.NOT_FOUND)
            return
        except ValueError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        except json.JSONDecodeError as exc:
            self.respond_json({"ok": False, "error": f"Invalid JSON: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.respond_json(result, HTTPStatus.OK)

    def handle_set_task_terminal_state(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length)
            payload = json.loads(raw_body.decode("utf-8"))
            result = set_task_terminal_state(self.data_root, payload)
        except FileNotFoundError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.NOT_FOUND)
            return
        except ValueError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        except json.JSONDecodeError as exc:
            self.respond_json({"ok": False, "error": f"Invalid JSON: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.respond_json(result, HTTPStatus.OK)

    def handle_create_task(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length)
            payload = json.loads(raw_body.decode("utf-8"))
            result = create_task(self.data_root, payload)
        except FileNotFoundError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.NOT_FOUND)
            return
        except ValueError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        except json.JSONDecodeError as exc:
            self.respond_json({"ok": False, "error": f"Invalid JSON: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.respond_json(result, HTTPStatus.OK)

    def handle_start_runtime(self) -> None:
        self.handle_runtime_mutation(start_runtime)

    def handle_probe_runtime_app_server(self) -> None:
        self.handle_runtime_mutation(probe_runtime_app_server)

    def handle_attach_runtime_app_server(self) -> None:
        self.handle_runtime_mutation(attach_runtime_app_server)

    def handle_stop_runtime_app_server(self) -> None:
        self.handle_runtime_mutation(stop_runtime_app_server)

    def handle_stop_runtime(self) -> None:
        self.handle_runtime_mutation(stop_runtime)

    def handle_reconnect_runtime(self) -> None:
        self.handle_runtime_mutation(reconnect_runtime)

    def handle_send_runtime_message(self) -> None:
        self.handle_runtime_mutation(send_runtime_message)

    def handle_runtime_mutation(self, callback: Any) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(length)
            payload = json.loads(raw_body.decode("utf-8"))
            result = callback(self.data_root, payload)
        except FileNotFoundError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.NOT_FOUND)
            return
        except ValueError as exc:
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        except json.JSONDecodeError as exc:
            self.respond_json({"ok": False, "error": f"Invalid JSON: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except Exception as exc:  # noqa: BLE001
            self.respond_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.respond_json(result, HTTPStatus.OK)

    def respond_json(self, payload: dict[str, Any], status: HTTPStatus) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    data_root = Path(args.data_root or args.root or get_default_data_root()).resolve()
    reconcile_all_runtime_processes(data_root)
    build_indexes(data_root, asset_source_root=repo_root)

    def handler(*handler_args: Any, **handler_kwargs: Any) -> ControlPlaneHandler:
        return ControlPlaneHandler(
            *handler_args,
            directory=str(repo_root),
            repo_root=repo_root,
            data_root=data_root,
            **handler_kwargs,
        )

    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Control plane server listening on http://{args.host}:{args.port}/gui/")
    print(f"repo_root={repo_root}")
    print(f"data_root={data_root}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        shutdown_all_runtime_processes(data_root)
        for bridge in list(APP_SERVER_BRIDGES.values()):
            bridge.shutdown()
        APP_SERVER_BRIDGES.clear()
        APP_SERVER_PROCESSES.clear()
        build_indexes(data_root, asset_source_root=repo_root)
        server.server_close()


if __name__ == "__main__":
    main()
