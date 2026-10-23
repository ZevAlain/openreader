# WebDAV 与手动备份面移除说明(2026-10-23)

本仓库已移除 WebDAV 协议与手动备份/恢复体系。本文档记录移除范围、保留能力,以及 `docs/compat/` 其余文档中 WebDAV 段落的解读方式。

## 移除范围

- WebDAV 协议端点(`/webdav`、`/reader3/webdav`,含 PROPFIND/MKCOL/MOVE/COPY/LOCK 等全部方法)与 Basic 认证通道。
- 手动备份/恢复 API:`/api/backup/*`(trigger、portable/trigger、list、download、restore-legado、restore-webdav)与 `/api/webdav/import*`。
- 可移植备份(portable v1/v2,含外观资产晋升)全部后端服务与前端入口。
- 阅读进度的 WebDAV 镜像(mirrorProgress)与上传接收(ingress)——legado 原生客户端兼容通道。
- 用户模型的 `CanAccessWebDAV` 权限位(列保留在历史库中不再读取;新库不再创建)。
- 前端 WebDAV 文件管理、保存备份、保存完整可移植备份、备份/同步用户配置入口。

## 保留能力

- **每日 23:50 静默自动备份**:`services/backup`,按用户写入 `data/webdav/users/<name>/backup_*.zip`(管理员落 `data/webdav/` 根;目录名保留历史布局,无 HTTP 入口)。
- **多端同步**:进度/书签/设置/书架/RSS 全部驻留服务端 SQLite,经 `/ws/sync` WebSocket 广播实时收敛;与 WebDAV 从无关。
- **用户管理**:管理员 CRUD、限额、书源权限(`canEditSources`)、书仓权限(`canAccessStore`)、密码重置、不活跃清理全部保留。
- `services/webdavfs` 包保留,作为章节缓存等场景的通用 rootedfs 工具(与 WebDAV 协议无关)。

## 其余文档的解读方式

`docs/compat/` 中早于本变更的文档(含 gap-analysis、data-migration、api-contract、各 second-audit 基线)提及 WebDAV/备份/恢复的段落,一律视为**历史验证记录**,描述的是移除前的行为,不再构成现行契约。现行行为以源码与本文档为准。
