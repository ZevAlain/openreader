import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const overlay = readFileSync(
  new URL('../src/components/overlays/OverlayReplaceRules.vue', import.meta.url),
  'utf8',
)
const manager = overlay.split('<v-dialog\n    v-model="replaceRuleDialog"')[0]

test('replace-rule manager keeps the fixed upstream dialog, table, and footer structure', () => {
  assert.match(manager, /app-dialog-title">\s*替换规则管理\s*</)
  assert.match(manager, /width="min\(1000px, calc\(100vw - 48px\)\)"/)
  assert.match(manager, /:fullscreen="isMobile"/)
  assert.match(manager, />\s*导入\s*</)
  assert.match(
    manager,
    /:height="isMobile \? 'calc\(100dvh - 184px\)' : 'min\(400px, calc\(70dvh - 184px\)\)'"/,
  )

  for (const label of ['规则名称', '替换范围', '是否启用', '操作']) {
    assert.match(overlay, new RegExp(`title: '${label}'`), `missing upstream table column ${label}`)
  }
  assert.match(overlay, /title: '规则名称', key: 'name'/)
  assert.match(overlay, /title: '替换范围', key: 'scope'/)
  assert.match(manager, />\s*编辑\s*</)
  assert.match(manager, />\s*批量删除\s*</)
  assert.match(manager, /已选择\s*\{\{\s*selectedReplaceRuleIds\.length\s*\}\}\s*个/)
  assert.match(manager, />\s*取消\s*</)

  assert.doesNotMatch(manager, /新增规则|>\s*刷新\s*<|逐行删除/)
  assert.doesNotMatch(manager, /label="匹配"|label="替换为"|label="正则"/)
  assert.doesNotMatch(manager, /mobile-rule-list|mobile-rule-card/)
  assert.doesNotMatch(manager, /removeReplaceRule/)
  assert.doesNotMatch(manager, /:icon="Upload"/)
})

test('replace-rule editor is the fixed sibling form without a competing test surface', () => {
  assert.match(overlay, /v-model="replaceRuleDialog"[\s\S]*?app-dialog-title">\s*替换规则\s*</)
  assert.match(overlay, /v-model="replaceRuleDialog"[\s\S]*?width="min\(1000px, calc\(100vw - 48px\)\)"/)

  for (const label of ['名称', '规则', '替换为', '替换范围']) {
    assert.match(overlay, new RegExp(`label="${label}"`))
  }
  assert.match(overlay, /v-model="replaceRuleDraft\.isRegex"[\s\S]*?使用正则表达式/)
  assert.match(overlay, /v-model="replaceRuleDraft\.enabled"[\s\S]*?是否启用/)
  assert.match(overlay, />\s*取 消\s*</)
  assert.match(overlay, />\s*确 定\s*</)

  assert.doesNotMatch(overlay, /新增替换规则|编辑替换规则/)
  assert.doesNotMatch(overlay, /测试文本|测试规则|replaceRuleTest/)
  assert.doesNotMatch(overlay, /active-text="使用正则表达式"|active-text="启用"/)
  assert.match(overlay, /managerOperationGuard:\s*managerOperations/)
  assert.match(overlay, /editorOperationGuard:\s*editorOperations/)
})
