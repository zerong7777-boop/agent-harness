# 控制面 GUI

这是一个零依赖、只读的本地控制面 GUI。

## 读取内容

- `indexes/overview.json`
- `indexes/tasks.json`
- `indexes/task-details/*.json`
- `indexes/accounts.json`
- `indexes/machines.json`
- `indexes/knowledge.json`

## 启动方式

在 `E:\codex-home` 目录下执行：

```powershell
py -3 .\scripts\control_plane_server.py
```

然后打开：

```text
http://localhost:4173/gui/
```

## 当前范围

- 任务优先的总览界面
- 待决策事项
- 最近结论
- 实验时间线
- 当前选中任务的详细信息

当前已经支持：

- 查看任务总览
- 查看待决策事项
- 在 GUI 中确认待决策事项

实验、知识和任务正文编辑仍然不在这一版范围内。
