from __future__ import annotations

import argparse
import json
import re
import tomllib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SKIP_FILE_NAMES = {"README.md"}
DEFAULT_ASSET_SOURCE_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class MarkdownRecord:
    path: Path
    data: dict[str, Any]
    body: str
    summary: str


ASSET_CATEGORY_ORDER = ["skills", "guides", "rules", "templates", "knowledge_links"]
ASSET_CATEGORY_META: dict[str, dict[str, Any]] = {
    "skills": {
        "title": "Skills",
        "description": "Workflow and execution skills available to the workspace.",
        "default_expanded": True,
    },
    "guides": {
        "title": "Guides",
        "description": "Repo guides and operational references.",
        "default_expanded": True,
    },
    "rules": {
        "title": "Rules",
        "description": "Policy and guardrail files used by the workspace.",
        "default_expanded": False,
    },
    "templates": {
        "title": "Templates",
        "description": "Selected task and knowledge templates.",
        "default_expanded": False,
    },
    "knowledge_links": {
        "title": "Knowledge Links",
        "description": "Knowledge and registry reference sources.",
        "default_expanded": False,
    },
}
STAGE_TO_RECOMMENDED_TAGS: dict[str, list[str]] = {
    "clarification": ["brainstorming", "spec", "handoff"],
    "planning": ["plan", "design", "task-breakdown"],
    "execution": ["runtime", "experiment", "machine", "implementation"],
    "verification": ["verification", "review", "handoff"],
    "knowledge-review": ["memory", "handoff", "knowledge"],
}
TAG_KEYWORDS = [
    "brainstorming",
    "spec",
    "handoff",
    "plan",
    "design",
    "task-breakdown",
    "runtime",
    "experiment",
    "machine",
    "implementation",
    "verification",
    "review",
    "memory",
    "knowledge",
    "guide",
    "remote",
    "execution",
    "policy",
    "rules",
    "template",
    "skill",
    "registry",
    "session",
    "account",
    "task",
    "ssh",
    "linux",
    "data",
    "root",
]
COMMENT_PREFIXES = ("#", "//", ";", "--")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build derived JSON indexes from control-plane Markdown.")
    parser.add_argument("--root", default=".", help="Control-plane root directory.")
    parser.add_argument("--output", default=None, help="Override output directory. Defaults to <root>/indexes.")
    parser.add_argument(
        "--asset-source-root",
        default=str(DEFAULT_ASSET_SOURCE_ROOT),
        help="Root used for asset discovery. Defaults to the repository root.",
    )
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


def parse_optional_markdown_record(path: Path) -> tuple[dict[str, Any], str] | None:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    if text.startswith("+++\n"):
        end_marker = "\n+++"
        end_index = text.find(end_marker, 4)
        if end_index != -1:
            frontmatter = text[4:end_index]
            body = text[end_index + len(end_marker):].lstrip("\r\n")
            try:
                return tomllib.loads(frontmatter), body
            except tomllib.TOMLDecodeError:
                return {}, body
    if text.startswith("---\n"):
        end_marker = "\n---"
        end_index = text.find(end_marker, 4)
        if end_index != -1:
            frontmatter = text[4:end_index]
            body = text[end_index + len(end_marker):].lstrip("\r\n")
            return parse_yaml_frontmatter(frontmatter), body
    return {}, text


def parse_yaml_frontmatter(frontmatter: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for raw_line in frontmatter.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        data[key.strip()] = parse_scalar_value(raw_value.strip())
    return data


def parse_scalar_value(value: str) -> Any:
    if not value:
        return ""
    if value.startswith("[") and value.endswith("]"):
        try:
            return json.loads(value.replace("'", '"'))
        except json.JSONDecodeError:
            return [part.strip().strip('"').strip("'") for part in value[1:-1].split(",") if part.strip()]
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    lower = value.lower()
    if lower in {"true", "false"}:
        return lower == "true"
    if re.fullmatch(r"-?\d+", value):
        try:
            return int(value)
        except ValueError:
            return value
    return value


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


def extract_first_heading(body: str) -> str:
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line.startswith("#"):
            continue
        heading = line.lstrip("#").strip()
        if heading:
            return heading
    return ""


def extract_first_comment_or_line(text: str) -> str:
    first_non_empty = ""
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if not first_non_empty:
            first_non_empty = line
        if line.startswith(COMMENT_PREFIXES):
            return line.lstrip("#/; -").strip()
    return first_non_empty


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "item"


def tokenize_text(value: str) -> set[str]:
    normalized = re.sub(r"[^a-z0-9]+", " ", value.lower())
    words = [word for word in normalized.split() if word]
    tokens = set(words)
    for left, right in zip(words, words[1:]):
        tokens.add(f"{left}-{right}")
    return tokens


def extract_tags_from_text(*texts: str) -> list[str]:
    tokens: set[str] = set()
    for text in texts:
        tokens.update(tokenize_text(text))
    tags: list[str] = []
    for keyword in TAG_KEYWORDS:
        if keyword in tokens and keyword not in tags:
            tags.append(keyword)
    return tags


def normalize_tags(*values: Any) -> list[str]:
    tags: list[str] = []
    for value in values:
        if isinstance(value, str) and value:
            normalized = slugify(value)
            if normalized not in tags:
                tags.append(normalized)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item and item not in tags:
                    normalized = slugify(item)
                    if normalized not in tags:
                        tags.append(normalized)
    return tags


def build_asset_item(
    *,
    asset_id: str,
    category: str,
    title: str,
    summary: str,
    source_root: Path,
    source_path: Path,
    status: str,
    phase_hints: list[str],
    tags: list[str],
) -> dict[str, Any]:
    return {
        "asset_id": asset_id,
        "category": category,
        "title": title,
        "summary": summary,
        "source_root_id": "asset-source-root",
        "source_path": relpath(source_path, source_root),
        "status": status,
        "phase_hints": sorted(set(phase_hints)),
        "tags": sorted(set(tags)),
    }


def infer_phase_hints(tags: list[str]) -> list[str]:
    hints: set[str] = set()
    for stage, stage_tags in STAGE_TO_RECOMMENDED_TAGS.items():
        if any(tag in tags for tag in stage_tags):
            hints.add(stage)
    return sorted(hints)


def build_asset_recommendations(assets: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    recommendations: dict[str, list[dict[str, Any]]] = {}
    for stage, stage_tags in STAGE_TO_RECOMMENDED_TAGS.items():
        scored: list[tuple[int, str, dict[str, Any]]] = []
        for asset in assets:
            tags = set(asset.get("tags", []))
            phase_hints = set(asset.get("phase_hints", []))
            score = sum(1 for tag in stage_tags if tag in tags or tag in phase_hints)
            if score:
                scored.append((score, str(asset.get("title", "")), asset))
        scored.sort(key=lambda item: (-item[0], item[1], str(item[2].get("asset_id", ""))))
        recommendations[stage] = [item[2] for item in scored[:5]]
    return recommendations


def collect_skill_assets(root: Path) -> list[dict[str, Any]]:
    skills_root = root / "skills"
    if not skills_root.exists():
        return []

    items: list[dict[str, Any]] = []
    for path in sorted(skills_root.rglob("SKILL.md")):
        record = parse_optional_markdown_record(path)
        if record is None:
            continue
        data, body = record
        title = str(data.get("name") or data.get("title") or path.parent.name)
        summary = str(data.get("description") or extract_summary(body) or extract_first_heading(body))
        raw_tags = normalize_tags(data.get("tags", []))
        tags = normalize_tags(
            raw_tags,
            extract_tags_from_text(title, summary, path.parent.name, path.as_posix()),
            ["skill"],
            ["system"] if ".system" in path.parts else [],
        )
        phase_hints = infer_phase_hints(tags)
        status = "active" if bool(data.get("enabled", True)) else "inactive"
        items.append(
            build_asset_item(
                asset_id=f"skills:{slugify(str(data.get('name') or path.parent.name))}",
                category="skills",
                title=title,
                summary=summary,
                source_root=root,
                source_path=path,
                status=status,
                phase_hints=phase_hints,
                tags=tags,
            )
        )
    items.sort(key=lambda item: (item["title"].lower(), item["asset_id"]))
    return items


def collect_guide_assets(root: Path) -> list[dict[str, Any]]:
    guides_root = root / "guides"
    if not guides_root.exists():
        return []

    items: list[dict[str, Any]] = []
    for path in sorted(guides_root.rglob("*.md")):
        record = parse_optional_markdown_record(path)
        if record is None:
            continue
        data, body = record
        title = str(data.get("title") or extract_first_heading(body) or path.stem)
        heading = extract_first_heading(body) or title
        opening_paragraph = extract_summary(body)
        if heading and opening_paragraph:
            summary = f"{heading} — {opening_paragraph}"
        else:
            summary = heading or opening_paragraph or title
        tags = normalize_tags(
            data.get("tags", []),
            extract_tags_from_text(title, summary, path.stem, path.as_posix()),
            ["guide"],
        )
        phase_hints = infer_phase_hints(tags)
        items.append(
            build_asset_item(
                asset_id=f"guides:{slugify(path.stem)}",
                category="guides",
                title=title,
                summary=summary,
                source_root=root,
                source_path=path,
                status="reference",
                phase_hints=phase_hints,
                tags=tags,
            )
        )
    items.sort(key=lambda item: (item["title"].lower(), item["asset_id"]))
    return items


def collect_rule_assets(root: Path) -> list[dict[str, Any]]:
    rules_root = root / "rules"
    if not rules_root.exists():
        return []

    items: list[dict[str, Any]] = []
    for path in sorted(rules_root.rglob("*.rules")):
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        title = path.stem.replace("-", " ").title()
        summary_source = extract_first_comment_or_line(text)
        summary = f"{title}: {summary_source}" if summary_source else title
        tags = normalize_tags(extract_tags_from_text(title, path.stem, path.as_posix()), ["rules", "policy"])
        phase_hints = infer_phase_hints(tags)
        items.append(
            build_asset_item(
                asset_id=f"rules:{slugify(path.stem)}",
                category="rules",
                title=title,
                summary=summary,
                source_root=root,
                source_path=path,
                status="policy",
                phase_hints=phase_hints,
                tags=tags,
            )
        )
    items.sort(key=lambda item: (item["title"].lower(), item["asset_id"]))
    return items


def collect_template_assets(root: Path) -> list[dict[str, Any]]:
    template_roots = [root / "tasks" / "_templates"]
    items: list[dict[str, Any]] = []
    seen_paths: set[Path] = set()
    for template_root in template_roots:
        if not template_root.exists():
            continue
        for path in sorted(template_root.rglob("*.md")):
            if path in seen_paths:
                continue
            seen_paths.add(path)
            record = parse_optional_markdown_record(path)
            if record is None:
                continue
            data, body = record
            title = str(data.get("title") or path.stem.replace("-", " ").title())
            relative_parent = path.parent.relative_to(template_root)
            folder_purpose = " / ".join(part.replace("-", " ") for part in relative_parent.parts) or "templates"
            summary = f"{title} for {folder_purpose}"
            tags = normalize_tags(
                data.get("tags", []),
                extract_tags_from_text(title, summary, path.stem, folder_purpose, path.as_posix()),
                ["template"],
            )
            phase_hints = infer_phase_hints(tags)
            asset_group = path.parent.name if path.parent.name != "_templates" else path.parent.parent.name
            items.append(
                build_asset_item(
                    asset_id=f"templates:{slugify(asset_group)}:{slugify(path.stem)}",
                    category="templates",
                    title=title,
                    summary=summary,
                    source_root=root,
                    source_path=path,
                    status="template",
                    phase_hints=phase_hints,
                    tags=tags,
                )
            )
    items.sort(key=lambda item: (item["title"].lower(), item["asset_id"]))
    return items


def collect_knowledge_link_assets(root: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    knowledge_readme = root / "knowledge" / "README.md"
    if knowledge_readme.exists():
        record = parse_optional_markdown_record(knowledge_readme)
        if record is not None:
            data, body = record
            title = str(data.get("title") or extract_first_heading(body) or "Knowledge")
            summary = str(data.get("summary") or extract_summary(body) or title)
            tags = normalize_tags(
                data.get("tags", []),
                extract_tags_from_text(title, summary, "knowledge", knowledge_readme.as_posix()),
                ["knowledge", "reference"],
            )
            items.append(
                build_asset_item(
                    asset_id="knowledge_links:knowledge-readme",
                    category="knowledge_links",
                    title=title,
                    summary=summary,
                    source_root=root,
                    source_path=knowledge_readme,
                    status="reference",
                    phase_hints=infer_phase_hints(tags),
                    tags=tags,
                )
            )

    registry_root = root / "skills-registry"
    if registry_root.exists():
        index_path = registry_root / "index.md"
        if index_path.exists():
            record = parse_optional_markdown_record(index_path)
            if record is not None:
                data, body = record
                title = str(data.get("title") or extract_first_heading(body) or "Skills Registry")
                summary = str(data.get("summary") or extract_summary(body) or title)
                tags = normalize_tags(
                    data.get("tags", []),
                    extract_tags_from_text(title, summary, "skills-registry", index_path.as_posix()),
                    ["knowledge", "registry", "reference"],
                )
                items.append(
                    build_asset_item(
                        asset_id="knowledge_links:skills-registry-index",
                        category="knowledge_links",
                        title=title,
                        summary=summary,
                        source_root=root,
                        source_path=index_path,
                        status=str(data.get("object_kind") or "reference"),
                        phase_hints=infer_phase_hints(tags),
                        tags=tags,
                    )
                )

        for path in sorted((registry_root / "sources").glob("*.md")):
            record = parse_optional_markdown_record(path)
            if record is None:
                continue
            data, body = record
            source_id = str(data.get("source_id") or path.stem)
            title = str(data.get("title") or source_id.replace("-", " ").title())
            summary = str(data.get("summary") or extract_summary(body) or title)
            tags = normalize_tags(
                data.get("tags", []),
                extract_tags_from_text(title, summary, source_id, "source", path.as_posix()),
                ["knowledge", "registry", "reference", "source"],
            )
            items.append(
                build_asset_item(
                    asset_id=f"knowledge_links:skills-registry:{slugify(source_id)}",
                    category="knowledge_links",
                    title=title,
                    summary=summary,
                    source_root=root,
                    source_path=path,
                    status=str(data.get("governance_status") or "reference"),
                    phase_hints=infer_phase_hints(tags),
                    tags=tags,
                )
            )

    items.sort(key=lambda item: (item["title"].lower(), item["asset_id"]))
    return items


def collect_assets(root: Path) -> dict[str, Any]:
    categories: dict[str, list[dict[str, Any]]] = {
        "skills": collect_skill_assets(root),
        "guides": collect_guide_assets(root),
        "rules": collect_rule_assets(root),
        "templates": collect_template_assets(root),
        "knowledge_links": collect_knowledge_link_assets(root),
    }
    category_payloads: list[dict[str, Any]] = []
    all_assets: list[dict[str, Any]] = []
    for category in ASSET_CATEGORY_ORDER:
        items = categories.get(category, [])
        all_assets.extend(items)
        meta = ASSET_CATEGORY_META[category]
        category_payloads.append(
            {
                "id": category,
                "title": meta["title"],
                "description": meta["description"],
                "count": len(items),
                "default_expanded": meta["default_expanded"],
                "items": items,
            }
        )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_roots": [
            {
                "id": "asset-source-root",
                "kind": "repo-root-relative",
                "description": "Asset source_path values are relative to the asset discovery root.",
            }
        ],
        "categories": category_payloads,
        "task_recommendations": build_asset_recommendations(all_assets),
    }


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
    content = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if path.exists():
        try:
            if path.read_text(encoding="utf-8") == content:
                return
        except OSError:
            pass
    path.write_text(content, encoding="utf-8")


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


def build_indexes(
    root: Path,
    output: Path | None = None,
    *,
    asset_source_root: Path | None = None,
) -> dict[str, Any]:
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
    assets = collect_assets(asset_source_root or root)
    overview = build_overview(tasks, pending_decisions, recent_findings, knowledge, accounts, machines)

    write_json(destination / "overview.json", overview)
    write_json(destination / "tasks.json", {"generated_at": overview["generated_at"], "tasks": tasks})
    write_json(destination / "task-memories.json", {"generated_at": overview["generated_at"], "entries": task_memories})
    write_json(destination / "sessions.json", {"generated_at": overview["generated_at"], "sessions": sessions})
    write_json(destination / "runtimes.json", {"generated_at": overview["generated_at"], "runtimes": runtimes})
    write_json(destination / "knowledge.json", {"generated_at": overview["generated_at"], "entries": knowledge})
    write_json(destination / "accounts.json", {"generated_at": overview["generated_at"], "accounts": accounts})
    write_json(destination / "machines.json", {"generated_at": overview["generated_at"], "machines": machines})
    write_json(destination / "assets.json", assets)
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
    asset_source_root = Path(args.asset_source_root).resolve()
    build_indexes(root, output, asset_source_root=asset_source_root)


if __name__ == "__main__":
    main()
