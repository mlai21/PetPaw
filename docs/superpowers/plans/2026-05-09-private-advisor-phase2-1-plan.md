# Private Advisor Phase 2.1 Implementation Plan

> Goal: 在不破坏 Phase 2 稳定性的前提下，完成“分身玩法配置化底座 + 桌面交互契约 + 服务端同步契约预留”。

## Task 1: 分身玩法配置模型落地（Mobile Domain）

**Deliverables**
- 新增 `AvatarPlayConfig` 与相关子结构
- 将现有进化规则、质量加权、人格文案接入配置读取

**Verification**
- `cd apps/mobile && flutter test test/domain/avatar -r compact`

## Task 2: 配置仓储与默认配置策略（Mobile Data）

**Deliverables**
- 新增 `AvatarConfigRepository`（先本地默认配置）
- 增加配置版本号与最小字段校验

**Verification**
- `cd apps/mobile && flutter test test/domain/avatar test/features/avatar -r compact`

## Task 3: 桌面交互契约扩展（Platform Contract）

**Deliverables**
- 从 `DesktopCapability` 扩展为更完整契约对象
- 增加能力矩阵 + fallback 策略测试

**Verification**
- `cd apps/mobile && flutter test test/platform/desktop -r compact`

## Task 4: API 配置同步契约预留（Server Contract）

**Deliverables**
- 新增配置摘要类型与兼容性校验服务（静态/Mock 即可）
- 增加对应单元测试

**Verification**
- `cd services/api && pnpm test test/advisor test/sync`

## Task 5: 集成回归与文档收口

**Deliverables**
- 回归 mobile + api 全量测试
- 更新 release checklist 与 progress 记录

**Verification**
- `cd apps/mobile && flutter test`
- `cd services/api && pnpm test`

## 执行顺序

按 Task 1 -> 5 顺序推进，优先保证移动端配置化基础可运行，再补齐服务端契约与回归。

## 注意事项

- 每个 Task 都以“先测后改（RED -> GREEN）”执行
- 若发现配置模型影响现有行为，先补回归测试再修实现
- 前端视觉雏形不在本轮实现范围内，后续独立迭代
