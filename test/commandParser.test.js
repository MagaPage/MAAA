const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseCommand, validateParams, VALID_ACTIONS } = require('../src/ai/commandParser')

describe('parseCommand', () => {
  it('should parse valid JSON command', () => {
    const result = parseCommand('{"action": "navigate", "params": {"x": 100, "y": 64, "z": 200}}')
    assert.equal(result.success, true)
    assert.equal(result.action, 'navigate')
    assert.equal(result.params.x, 100)
  })

  it('should extract JSON from markdown code blocks', () => {
    const input = 'Here is the command:\n```json\n{"action": "mine", "params": {"radius": 32}}\n```'
    const result = parseCommand(input)
    assert.equal(result.success, true)
    assert.equal(result.action, 'mine')
    assert.equal(result.params.radius, 32)
  })

  it('should extract JSON from mixed text', () => {
    const input = 'I will navigate to those coordinates. {"action": "navigate", "params": {"x": 50, "y": 70, "z": -100}}'
    const result = parseCommand(input)
    assert.equal(result.success, true)
    assert.equal(result.action, 'navigate')
  })

  it('should reject invalid JSON', () => {
    const result = parseCommand('not json at all')
    assert.equal(result.success, false)
    assert.ok(result.error.includes('Failed to parse JSON'))
  })

  it('should reject missing action field', () => {
    const result = parseCommand('{"params": {"x": 1}}')
    assert.equal(result.success, false)
    assert.ok(result.error.includes('Missing required field: action'))
  })

  it('should reject invalid action', () => {
    const result = parseCommand('{"action": "fly", "params": {}}')
    assert.equal(result.success, false)
    assert.ok(result.error.includes('Invalid action'))
  })

  it('should parse build command with type', () => {
    const result = parseCommand('{"action": "build", "params": {"type": "tower", "block": "cobblestone", "height": 20}}')
    assert.equal(result.success, true)
    assert.equal(result.action, 'build')
    assert.equal(result.params.type, 'tower')
  })

  it('should parse chat command', () => {
    const result = parseCommand('{"action": "chat", "params": {"message": "Hello!"}}')
    assert.equal(result.success, true)
    assert.equal(result.action, 'chat')
    assert.equal(result.params.message, 'Hello!')
  })

  it('should parse stop command with empty params', () => {
    const result = parseCommand('{"action": "stop", "params": {}}')
    assert.equal(result.success, true)
    assert.equal(result.action, 'stop')
  })
})

describe('validateParams', () => {
  it('should validate navigate params', () => {
    const result = validateParams('navigate', { x: 10, y: 64, z: -20 })
    assert.equal(result.valid, true)
  })

  it('should reject navigate with non-number coords', () => {
    const result = validateParams('navigate', { x: 'abc', y: 64, z: -20 })
    assert.equal(result.valid, false)
  })

  it('should reject build with missing type', () => {
    const result = validateParams('build', { block: 'stone' })
    assert.equal(result.valid, false)
  })

  it('should reject build with invalid type', () => {
    const result = validateParams('build', { type: 'spaceship' })
    assert.equal(result.valid, false)
  })

  it('should validate mine with no params (all optional)', () => {
    const result = validateParams('mine', {})
    assert.equal(result.valid, true)
  })

  it('should validate chat with message', () => {
    const result = validateParams('chat', { message: 'hello' })
    assert.equal(result.valid, true)
  })

  it('should reject chat with missing message', () => {
    const result = validateParams('chat', {})
    assert.equal(result.valid, false)
  })
})

describe('VALID_ACTIONS', () => {
  it('should contain expected actions', () => {
    assert.ok(VALID_ACTIONS.includes('build'))
    assert.ok(VALID_ACTIONS.includes('mine'))
    assert.ok(VALID_ACTIONS.includes('navigate'))
    assert.ok(VALID_ACTIONS.includes('follow'))
    assert.ok(VALID_ACTIONS.includes('chat'))
    assert.ok(VALID_ACTIONS.includes('stop'))
    assert.ok(VALID_ACTIONS.includes('scan'))
  })
})
