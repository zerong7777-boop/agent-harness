# Remote Execution Guide For Codex

This file is the canonical guide for future Codex sessions that need to work on a remote Linux machine.

## Remote Host

- Preferred route: a named SSH alias such as `lab-remote`
- SSH user: your remote Linux username
- Network target: your own MagicDNS name, hostname, or private IP
- Machine profile: document the OS, GPU, and storage you actually use

When in doubt, use an explicit Windows SSH form:

```powershell
& 'C:\Windows\System32\OpenSSH\ssh.exe' -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL <user>@<host> "<remote command>"
```

Use `scp.exe` for file sync:

```powershell
& 'C:\Windows\System32\OpenSSH\scp.exe' -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL <local_path> <user>@<host>:<remote_path>
```

## SSH Config Reference

The intended local SSH config shape is:

```ssh
Host lab-remote
  HostName <remote-hostname-or-ip>
  User <remote-user>
```

If aliases fail, fall back to the explicit `ssh.exe` form above.

## Proxy Defaults On Remote

If your remote environment needs a proxy, document the standard exports here and apply them explicitly in non-interactive shells.

Example:

```bash
export HTTPS_PROXY="http://127.0.0.1:7890"
export HTTP_PROXY="http://127.0.0.1:7890"
export ALL_PROXY="http://127.0.0.1:7890"
export https_proxy="$HTTPS_PROXY"
export http_proxy="$HTTP_PROXY"
export all_proxy="$ALL_PROXY"
export NO_PROXY="localhost,127.0.0.1,::1"
export no_proxy="$NO_PROXY"
```

Do not assume the proxy is already set in a non-interactive SSH shell.

## Remote Conda / Python Notes

Do not assume `conda` is on `PATH` in non-interactive SSH sessions.

Preferred pattern:

- Use the explicit Python path of the target environment when known.
- Avoid depending on shell init files.

## Cache / Download Policy

When running remote ML projects, prefer project-local caches so artifacts remain reproducible and discoverable.

Example:

```bash
TORCH_HOME=/path/to/project/.cache/torch
HF_HOME=/path/to/project/.cache/huggingface
```

Avoid silently using `/tmp` or unrelated global caches when the project should be self-contained.

## Standard Remote Workflow

For a remote coding or reproduction task:

1. Confirm the target project root.
2. Confirm the exact remote Python / conda environment.
3. Confirm whether proxy exports are needed.
4. Use project-local `TORCH_HOME` / `HF_HOME` if the project downloads weights or models.
5. Run the smallest meaningful verification first:
   - config parse
   - model instantiation
   - smoke run
   - full eval
6. Record:
   - command
   - result path
   - log path
   - final metric

## Guardrails

- Do not assume a task is local if the user gives a remote path.
- Do not claim a remote step succeeded without command-backed evidence.
- Do not rely on interactive shell behavior for `conda`, proxy setup, or `PATH`.
- Prefer explicit paths over implicit shell state.
- When syncing files to the remote machine, verify the destination exists if an upload appears to succeed but the file is missing.

## Recommended User-Facing Summary Pattern

When reporting remote progress, prefer:

- what command was run
- where the result/log lives
- whether the step succeeded
- the next single recommended action

Keep the update evidence-bound and concise.
