import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSettingsTrigger,
  settingsNavIndex,
} from '../src/client/settings-opener.ts'

test('recognizes the collapsed official settings trigger from aria-label', () => {
  assert.equal(isSettingsTrigger('', '设置'), true)
  assert.equal(isSettingsTrigger('', 'Settings'), true)
})

test('does not mistake another dialog trigger for settings', () => {
  assert.equal(isSettingsTrigger('搜索对话', '搜索对话'), false)
  assert.equal(isSettingsTrigger('打开设置模型', '打开设置模型'), false)
})

test('finds a section by label when third-party sections alter nav order', () => {
  const labels = ['通用', '宠物', '模型', '插件', '代理预设']
  assert.equal(settingsNavIndex(labels, '模型', 1), 2)
  assert.equal(settingsNavIndex(labels, '插件', 2), 3)
})

test('falls back to the known index when no matching label exists', () => {
  assert.equal(settingsNavIndex(['General', 'Models'], 'Plugins', 1), 1)
})

test('returns undefined when neither a matching label nor fallback exists', () => {
  assert.equal(settingsNavIndex([], 'Models', 1), undefined)
})
