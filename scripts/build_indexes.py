from __future__ import annotations

import argparse
import json
import tomllib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SKIP_FILE_NAMES = {"README.md"}


@dataclass
class MarkdownRecord:
    path: Path
    data: dict[str, Any]
    body: str
    summary: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build derived JSON indexes from control-plane Markdown.")
    parser.add_argument("--root", default=".", help="Control-plane root directory.")
    parser.add_argument("--output", default=None, help="Override output directory. Defaults to <root>/indexes.")
    return parser.parse_args()


def parse_markdown_record(path: Path) -> MarkdownRecord:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("+++\n"):
        raise ValueError(f"{path} is missing TOML frontmatter")

    end_marker = "\n+++"
    end_index = text.find(end_marker, 4)
    if end_index == -1:
        raise ValueError(f"{path} has malformed TOML frontmatter")

    frontmatter = text[4:end_index]
    body = text[end_index + len(end_marker):].lstrip("\r\n")
    data = tomllib.loads(frontmatter)
    summary = extract_summary(body)
    return MarkdownRecord(path=path, data=data, body=body, summary=summary)


def extract_summary(body: str) -> str:
    paragraph: list[str] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            if paragraph:
                break
            continue
        if line.startswith("#"):
            continue
        paragraph.append(line)
    return " ".join(paragraph)


def extract_bullet_events(body: str) -> list[dict[str, str]]:
    events: list[dict[str, str]] = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line.startswith("- "):
            continue
        payload = line[2:]
        parts = [part.strip() for part in payload.split(" | ", 3)]
        if len(parts) < 4:
            continue
        events.append(
            {
                "timestamp": parts[0],
                "kind": parts[1],
                "scope": parts[2],
                "summary": parts[3],
            }
        )
    return events


def should_skip(path: Path) -> bool:
    if path.name in SKIP_FILE_NAMES:
        return True
    return any(part.startswith("_") or part.startswith(".") for part in path.parts)


def safe_iso(value: str | None) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def clear_json_children(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for path in folder.glob("*.json"):
        try:
            path.unlink()
        except PermissionError:
            continue


def record_identity(record: MarkdownRecord, key: str) -> str:
    return str(record.data.get(key) or record.path.stem)


def relpath(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def collect_knowledge(root: Path) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    knowledge_root = root / "knowledge"
    if not knowledge_root.exists():
        return entries

    for path in sorted(knowledge_root.rglob("*.md")):
        if should_skip(path):
            continue
        record = parse_markdown_record(path)
        if record.data.get("object_kind") != "knowledge-entry":
            continue
        payload = dict(record.data)
        payload["path"] = relpath(path, root)
        payload["summary"] = record.summary
        entries.append(payload)
    entries.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)
    return entries


def collect_simple_records(root: Path, folder: str, object_kind: str, key_name: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    folder_root = root / folder
    if not folder_root.exists():
        return records

    for path in sorted(folder_root.rglob("*.md")):
        if should_skip(path):
            continue
        record = parse_markdown_record(path)
        if record.data.get("object_kind") != object_kind:
            continue
        payload = dict(record.data)
        payload["path"] = relpath(path, root)
        payload["summary"] = record.summary
        payload[key_name] = record_identity(record, key_name)
        records.append(payload)
    records.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)
    return records


def collect_nested_records(root: Path, folder: Path, object_kind: str, key_name: str) -> list[dict[str, Any]]:
    if not folder.exists():
        return []

    records: list[dict[str, Any]] = []
    for path in sorted(folder.rglob("*.md")):
        if should_skip(path):
            continue
        record = parse_markdown_record(path)
        if record.data.get("object_kind") != object_kind:
            continue
        payload = dict(record.data)
        payload[key_name] = record_identity(record, key_name)
        payload["path"] = relpath(path, root)
        payload["summary"] = record.summary
        records.append(payload)
    records.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)
    return records


def summarize_active_phase(task_payload: dict[str, Any], phases: list[dict[str, Any]]) -> dict[str, Any]:
    active_phase_id = str(task_payload.get("active_phase_id") or "")
    active_phase: dict[str, Any] | None = None

    if active_phase_id:
        active_phase = next((phase for phase in phases if phase.get("phase_id") == active_phase_id), None)

    if active_phase is None:
        active_phase = next(
            (phase for phase in phases if phase.get("status") in {"open", "running"}),
            phases[0] if phases else None,
        )

    if not active_phase:
        return {
            "active_phase_id": active_phase_id,
            "active_phase_kind": "",
            "active_phase_status": "",
            "active_phase_title": "",
        }

    return {
        "active_phase_id": active_phase.get("phase_id", active_phase_id),
        "active_phase_kind": active_phase.get("phase_kind", ""),
        "active_phase_status": active_phase.get("status", ""),
        "active_phase_title": active_phase.get("title", ""),
    }


def collect_task_memory(root: Path, task_dir: Path) -> dict[str, Any] | None:
    memory_dir = task_dir / "memory"
    if not memory_dir.exists():
        return None

    index_payload = None
    index_path = memory_dir / "index.md"
    if index_path.exists() and not should_skip(index_path):
        record = parse_markdown_record(index_path)
        if record.data.get("object_kind") == "task-memory-index":
            index_payload = dict(record.data)
            index_payload["path"] = relpath(index_path, root)
            index_payload["summary"] = record.summary

    blocks = collect_nested_records(root, memory_dir, "task-memory-block", "block_kind")
    history = collect_nested_records(root, memory_dir / "history", "task-memory-rollup", "rollup_id")
    return {
        "index": index_payload,
        "blocks": blocks,
        "history": history,
    }


def collect_sessions(root: Path, task_dir: Path, task_id: str) -> list[dict[str, Any]]:
    sessions_dir = task_dir / "sessions"
    if not sessions_dir.exists():
        return []

    sessions: list[dict[str, Any]] = []
    for index_path in sorted(sessions_dir.glob("*/index.md")):
        if should_skip(index_path):
            continue
        record = parse_markdown_record(index_path)
        if record.data.get("object_kind") != "session":
            continue

        session_dir = index_path.parent
        session_payload = dict(record.data)
        session_payload["path"] = relpath(index_path, root)
        session_payload["summary"] = record.summary
        session_payload["task_id"] = str(session_payload.get("task_id") or task_id)

        parts: dict[str, dict[str, Any] | None] = {}
        for file_name, object_kind, key in [
            ("cache.md", "session-cache", "cache"),
            ("summary.md", "session-summary", "summary"),
            ("handoff.md", "session-handoff", "handoff"),
            ("event-log.md", "session-event-log", "event_log"),
            ("attachments-index.md", "session-attachments-index", "attachments_index"),
        ]:
            path = session_dir / file_name
            if not path.exists() or should_skip(path):
                parts[key] = None
                continue
            part_record = parse_markdown_record(path)
            if part_record.data.get("object_kind") != object_kind:
                parts[key] = None
                continue
            part_payload = dict(part_record.data)
            part_payload["path"] = relpath(path, root)
            part_payload["summary"] = part_record.summary
            if key == "event_log":
                part_payload["events"] = extract_bullet_events(part_record.body)
            parts[key] = part_payload

        sessions.append({"session": session_payload, **parts})

    sessions.sort(
        key=lambda item: safe_iso(
            item["session"].get("last_event_at")
            or item["session"].get("updated_at")
            or item["session"].get("created_at")
        ),
        reverse=True,
    )
    return sessions


def collect_runtime(root: Path, task_dir: Path, task_id: str) -> dict[str, Any] | None:
    runtime_dir = task_dir / "runtime"
    if not runtime_dir.exists():
        return None

    parts: dict[str, dict[str, Any] | None] = {}
    for file_name, object_kind, key in [
        ("index.md", "task-runtime-index", "index"),
        ("status.md", "task-runtime-status", "status"),
        ("launch.md", "task-runtime-launch", "launch"),
        ("history.md", "task-runtime-history", "history"),
    ]:
        path = runtime_dir / file_name
        if not path.exists() or should_skip(path):
            parts[key] = None
            continue
        record = parse_markdown_record(path)
        if record.data.get("object_kind") != object_kind:
            parts[key] = None
            continue
        payload = dict(record.data)
        payload["task_id"] = str(payload.get("task_id") or task_id)
        payload["path"] = relpath(path, root)
        payload["summary"] = record.summary
        if key == "history":
            payload["events"] = extract_bullet_events(record.body)
        parts[key] = payload

    if not any(parts.values()):
        return None
    return parts


def collect_skills_registry(root: Path) -> dict[str, Any]:
    registry_root = root / "skills-registry"
    if not registry_root.exists():
        return {"index": None, "sources": [], "skills": []}

    index_payload = None
    index_path = registry_root / "index.md"
    if index_path.exists() and not should_skip(index_path):
        record = parse_markdown_record(index_path)
        if record.data.get("object_kind") == "skills-registry-index":
            index_payload = dict(record.data)
            index_payload["path"] = relpath(index_path, root)
            index_payload["summary"] = record.summary

    sources = collect_simple_records(root, "skills-registry/sources", "skill-source", "source_id")
    skills = collect_simple_records(root, "skills-registry/skills", "skill-record", "skill_id")

    skills_by_source: dict[str, list[str]] = {}
    for skill in skills:
        source_id = str(skill.get("source_id") or "")
        if source_id:
            skills_by_source.setdefault(source_id, []).append(str(skill.get("skill_id") or ""))

    for source in sources:
        source["tracked_skill_ids"] = sorted(skills_by_source.get(str(source.get("source_id") or ""), []))

    return {"index": index_payload, "sources": sources, "skills": skills}


def collect_tasks(
    root: Path,
    output: Path,
) -> tuple[
    list[dict[str, Any]],
    dict[str, dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    task_root = root / "tasks"
    task_summaries: list[dict[str, Any]] = []
    task_details: dict[str, dict[str, Any]] = {}
    pending_decisions: list[dict[str, Any]] = []
    recent_findings: list[dict[str, Any]] = []
    task_memory_summaries: list[dict[str, Any]] = []
    session_summaries: list[dict[str, Any]] = []
    runtime_summaries: list[dict[str, Any]] = []

    if not task_root.exists():
        return task_summaries, task_details, pending_decisions, recent_findings, task_memory_summaries, session_summaries, runtime_summaries

    task_files = sorted(task_root.glob("*/task.md"))
    task_records = [parse_markdown_record(path) for path in task_files if not should_skip(path)]
    task_by_id = {record_identity(record, "task_id"): record for record in task_records}

    parent_to_children: dict[str, list[str]] = {}
    for task_id, record in task_by_id.items():
        parent_id = str(record.data.get("parent_task_id") or "")
        if parent_id:
            parent_to_children.setdefault(parent_id, []).append(task_id)

    detail_output = output / "task-details"
    clear_json_children(detail_output)

    for task_id, record in sorted(task_by_id.items()):
        task_dir = record.path.parent
        phases = collect_nested_records(root, task_dir / "phases", "phase", "phase_id")
        decisions = collect_nested_records(root, task_dir / "decisions", "decision", "decision_id")
        experiments = collect_nested_records(root, task_dir / "experiments", "experiment", "experiment_id")
        findings = collect_nested_records(root, task_dir / "findings", "finding", "finding_id")
        candidates = collect_nested_records(root, task_dir / "knowledge-candidates", "knowledge-candidate", "candidate_id")
        plan_record = parse_markdown_record(task_dir / "plan.md") if (task_dir / "plan.md").exists() else None

        decision_items = [
            decision
            for decision in decisions
            if decision.get("status") == "pending" or decision.get("needs_user_confirmation")
        ]
        for decision in decision_items:
            pending_decisions.append(
                {
                    "task_id": task_id,
                    "title": decision.get("title", ""),
                    "decision_id": decision.get("decision_id"),
                    "status": decision.get("status", ""),
                    "path": decision.get("path", ""),
                    "updated_at": decision.get("updated_at", ""),
                }
            )

        for finding in findings:
            recent_findings.append(
                {
                    "task_id": task_id,
                    "finding_id": finding.get("finding_id"),
                    "title": finding.get("title", ""),
                    "finding_kind": finding.get("finding_kind", ""),
                    "stability": finding.get("stability", ""),
                    "path": finding.get("path", ""),
                    "updated_at": finding.get("updated_at", ""),
                }
            )

        plan_payload = None
        if plan_record is not None:
            plan_payload = dict(plan_record.data)
            plan_payload["path"] = relpath(plan_record.path, root)
            plan_payload["summary"] = plan_record.summary

        task_payload = dict(record.data)
        task_payload["path"] = relpath(record.path, root)
        task_payload["summary"] = record.summary
        task_payload["child_task_ids"] = sorted(parent_to_children.get(task_id, []))
        active_phase = summarize_active_phase(task_payload, phases)
        memory = collect_task_memory(root, task_dir)
        sessions = collect_sessions(root, task_dir, task_id)
        runtime = collect_runtime(root, task_dir, task_id)

        memory_index = memory.get("index") if memory else None
        runtime_index = runtime.get("index") if runtime else None
        runtime_status = runtime_index.get("runtime_status", "") if runtime_index else ""
        primary_session_id = runtime_index.get("primary_session_id", "") if runtime_index else ""
        runtime_last_event_at = runtime_index.get("last_event_at", "") if runtime_index else ""
        runtime_adapter = runtime_index.get("runtime_adapter", "") if runtime_index else ""
        app_server_probe_status = runtime_index.get("app_server_probe_status", "") if runtime_index else ""
        app_server_attach_status = runtime_index.get("app_server_attach_status", "") if runtime_index else ""
        app_server_bridge_status = runtime_index.get("app_server_bridge_status", "") if runtime_index else ""
        active_session_ids = memory_index.get("active_session_ids", []) if memory_index else []
        recommended_next_step = memory_index.get("recommended_next_step", "") if memory_index else ""
        pending_verification_count = int(memory_index.get("pending_verification_count", 0) or 0) if memory_index else 0
        last_rollup_at = memory_index.get("last_rollup_at", "") if memory_index else ""
        memory_summary = memory_index.get("summary", "") if memory_index else ""

        detail = {
            "task": task_payload,
            "plan": plan_payload,
            "phases": phases,
            "decisions": decisions,
            "experiments": experiments,
            "findings": findings,
            "knowledge_candidates": candidates,
            "memory": memory,
            "sessions": sessions,
            "runtime": runtime,
        }
        task_details[task_id] = detail
        write_json(detail_output / f"{task_id}.json", detail)

        if memory_index:
            task_memory_summaries.append(
                {
                    "task_id": task_id,
                    "title": memory_index.get("title", ""),
                    "current_stage": memory_index.get("current_stage", task_payload.get("stage", "")),
                    "current_phase_id": memory_index.get("current_phase_id", active_phase.get("active_phase_id", "")),
                    "current_phase_kind": memory_index.get("current_phase_kind", active_phase.get("active_phase_kind", "")),
                    "current_phase_status": memory_index.get("current_phase_status", active_phase.get("active_phase_status", "")),
                    "current_blockers": memory_index.get("current_blockers", []),
                    "recommended_next_step": recommended_next_step,
                    "last_rollup_at": last_rollup_at,
                    "pending_decision_count": int(memory_index.get("pending_decision_count", len(decision_items)) or 0),
                    "pending_verification_count": pending_verification_count,
                    "active_session_ids": active_session_ids,
                    "recent_experiment_ids": memory_index.get("recent_experiment_ids", []),
                    "recent_finding_ids": memory_index.get("recent_finding_ids", []),
                    "recent_decision_ids": memory_index.get("recent_decision_ids", []),
                    "updated_at": memory_index.get("updated_at", ""),
                    "path": memory_index.get("path", ""),
                    "summary": memory_summary,
                }
            )

        for session in sessions:
            session_summary = session["session"]
            session_summaries.append(
                {
                    "task_id": task_id,
                    "session_id": session_summary.get("session_id", ""),
                    "title": session_summary.get("title", ""),
                    "status": session_summary.get("status", ""),
                    "mode": session_summary.get("mode", ""),
                    "current_focus": session_summary.get("current_focus", ""),
                    "started_at": session_summary.get("started_at", ""),
                    "ended_at": session_summary.get("ended_at", ""),
                    "last_event_at": session_summary.get("last_event_at", ""),
                    "last_rollup_at": session_summary.get("last_rollup_at", ""),
                    "cache_retention_policy": session_summary.get("cache_retention_policy", ""),
                    "updated_at": session_summary.get("updated_at", ""),
                    "path": session_summary.get("path", ""),
                    "summary": session_summary.get("summary", ""),
                }
            )

        if runtime_index:
            runtime_summaries.append(
                {
                    "task_id": task_id,
                    "runtime_status": runtime_status,
                    "runtime_adapter": runtime_index.get("runtime_adapter", ""),
                    "primary_session_id": primary_session_id,
                    "session_status": runtime_index.get("session_status", ""),
                    "last_event_at": runtime_last_event_at,
                    "last_user_action_at": runtime_index.get("last_user_action_at", ""),
                    "last_error_summary": runtime_index.get("last_error_summary", ""),
                    "current_mode": runtime_index.get("current_mode", ""),
                    "current_focus": runtime_index.get("current_focus", ""),
                    "app_server_probe_status": runtime_index.get("app_server_probe_status", ""),
                    "app_server_process_owner": runtime_index.get("app_server_process_owner", ""),
                    "runtime_launcher_url": runtime_index.get("runtime_launcher_url", ""),
                    "app_server_port": int(runtime_index.get("app_server_port", 0) or 0),
                    "app_server_ws_url": runtime_index.get("app_server_ws_url", ""),
                    "app_server_pid": int(runtime_index.get("app_server_pid", 0) or 0),
                    "app_server_last_probe_at": runtime_index.get("app_server_last_probe_at", ""),
                    "app_server_attach_status": runtime_index.get("app_server_attach_status", ""),
                    "app_server_thread_id": runtime_index.get("app_server_thread_id", ""),
                    "app_server_last_attach_at": runtime_index.get("app_server_last_attach_at", ""),
                    "app_server_bridge_status": runtime_index.get("app_server_bridge_status", ""),
                    "app_server_bridge_pid": int(runtime_index.get("app_server_bridge_pid", 0) or 0),
                    "app_server_bridge_last_seen_at": runtime_index.get("app_server_bridge_last_seen_at", ""),
                    "account_id": runtime_index.get("account_id", ""),
                    "machine_id": runtime_index.get("machine_id", ""),
                    "updated_at": runtime_index.get("updated_at", ""),
                    "path": runtime_index.get("path", ""),
                    "summary": runtime_index.get("summary", ""),
                }
            )

        task_summaries.append(
            {
                "task_id": task_id,
                "title": task_payload.get("title", ""),
                "stage": task_payload.get("stage", ""),
                "terminal_state": task_payload.get("terminal_state", ""),
                "priority": task_payload.get("priority", ""),
                "paused": task_payload.get("paused", False),
                "blocked": task_payload.get("blocked", False),
                "blocker_kinds": task_payload.get("blocker_kinds", []),
                "assignee_account_id": task_payload.get("assignee_account_id", ""),
                "active_phase_id": active_phase.get("active_phase_id", ""),
                "active_phase_kind": active_phase.get("active_phase_kind", ""),
                "active_phase_status": active_phase.get("active_phase_status", ""),
                "active_phase_title": active_phase.get("active_phase_title", ""),
                "parent_task_id": task_payload.get("parent_task_id", ""),
                "child_task_ids": task_payload.get("child_task_ids", []),
                "machine_ids": task_payload.get("machine_ids", []),
                "primary_repo": task_payload.get("primary_repo", ""),
                "pending_decision_count": len(decision_items),
                "experiment_count": len(experiments),
                "finding_count": len(findings),
                "knowledge_candidate_count": len(candidates),
                "memory_summary": memory_summary or task_payload.get("summary", ""),
                "recommended_next_step": recommended_next_step,
                "last_rollup_at": last_rollup_at,
                "pending_verification_count": pending_verification_count,
                "active_session_count": len(active_session_ids) if active_session_ids else len(
                    [session for session in sessions if session["session"].get("status") in {"open", "running"}]
                ),
                "runtime_status": runtime_status,
                "runtime_adapter": runtime_adapter,
                "primary_session_id": primary_session_id,
                "runtime_last_event_at": runtime_last_event_at,
                "app_server_probe_status": app_server_probe_status,
                "app_server_attach_status": app_server_attach_status,
                "app_server_bridge_status": app_server_bridge_status,
                "updated_at": task_payload.get("updated_at", ""),
                "path": task_payload.get("path", ""),
            }
        )

    task_summaries.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)
    pending_decisions.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)
    recent_findings.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)
    task_memory_summaries.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)
    session_summaries.sort(
        key=lambda item: safe_iso(item.get("last_event_at") or item.get("updated_at")),
        reverse=True,
    )
    runtime_summaries.sort(
        key=lambda item: safe_iso(item.get("last_event_at") or item.get("updated_at")),
        reverse=True,
    )
    return (
        task_summaries,
        task_details,
        pending_decisions,
        recent_findings,
        task_memory_summaries,
        session_summaries,
        runtime_summaries,
    )


def build_overview(
    tasks: list[dict[str, Any]],
    pending_decisions: list[dict[str, Any]],
    recent_findings: list[dict[str, Any]],
    knowledge: list[dict[str, Any]],
    accounts: list[dict[str, Any]],
    machines: list[dict[str, Any]],
) -> dict[str, Any]:
    timeline: list[dict[str, Any]] = []
    for task in tasks:
        timeline.append(
            {
                "kind": "task-update",
                "task_id": task.get("task_id"),
                "title": task.get("title"),
                "stage": task.get("stage"),
                "updated_at": task.get("updated_at"),
            }
        )
    for finding in recent_findings[:20]:
        timeline.append(
            {
                "kind": "finding",
                "task_id": finding.get("task_id"),
                "title": finding.get("title"),
                "updated_at": finding.get("updated_at"),
            }
        )
    timeline.sort(key=lambda item: safe_iso(item.get("updated_at")), reverse=True)

    active_tasks = [task for task in tasks if not task.get("terminal_state")]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "tasks": len(tasks),
            "active_tasks": len(active_tasks),
            "knowledge_entries": len(knowledge),
            "accounts": len(accounts),
            "machines": len(machines),
            "pending_decisions": len(pending_decisions),
        },
        "active_tasks": active_tasks,
        "pending_decisions": pending_decisions[:20],
        "recent_findings": recent_findings[:20],
        "timeline": timeline[:40],
    }


def build_indexes(root: Path, output: Path | None = None) -> dict[str, Any]:
    destination = output or (root / "indexes")
    destination.mkdir(parents=True, exist_ok=True)

    (
        tasks,
        task_details,
        pending_decisions,
        recent_findings,
        task_memories,
        sessions,
        runtimes,
    ) = collect_tasks(root, destination)
    knowledge = collect_knowledge(root)
    accounts = collect_simple_records(root, "accounts", "account", "account_id")
    machines = collect_simple_records(root, "machines", "machine", "machine_id")
    skills_registry = collect_skills_registry(root)
    overview = build_overview(tasks, pending_decisions, recent_findings, knowledge, accounts, machines)

    write_json(destination / "overview.json", overview)
    write_json(destination / "tasks.json", {"generated_at": overview["generated_at"], "tasks": tasks})
    write_json(destination / "task-memories.json", {"generated_at": overview["generated_at"], "entries": task_memories})
    write_json(destination / "sessions.json", {"generated_at": overview["generated_at"], "sessions": sessions})
    write_json(destination / "runtimes.json", {"generated_at": overview["generated_at"], "runtimes": runtimes})
    write_json(destination / "knowledge.json", {"generated_at": overview["generated_at"], "entries": knowledge})
    write_json(destination / "accounts.json", {"generated_at": overview["generated_at"], "accounts": accounts})
    write_json(destination / "machines.json", {"generated_at": overview["generated_at"], "machines": machines})
    write_json(
        destination / "skills-registry.json",
        {
            "generated_at": overview["generated_at"],
            "index": skills_registry["index"],
            "sources": skills_registry["sources"],
            "skills": skills_registry["skills"],
        },
    )

    if destination != root / "indexes":
        detail_output = destination / "task-details"
        clear_json_children(detail_output)
        for task_id, detail in task_details.items():
            write_json(detail_output / f"{task_id}.json", detail)
    else:
        runtime_detail_output = destination / "runtime-details"
        clear_json_children(runtime_detail_output)
        for task_id, detail in task_details.items():
            write_json(
                runtime_detail_output / f"{task_id}.json",
                {
                    "generated_at": overview["generated_at"],
                    "task_id": task_id,
                    "runtime": detail.get("runtime"),
                    "sessions": detail.get("sessions", []),
                },
            )

    return overview


def main() -> None:
    args = parse_args()
    root = Path(args.root).resolve()
    output = Path(args.output).resolve() if args.output else root / "indexes"
    build_indexes(root, output)


if __name__ == "__main__":
    main()
