const VALID_ACTIONS = [
  'build', 'mine', 'navigate', 'follow', 'chat', 'stop', 'scan', 'equip', 'craft',
]

const ACTION_SCHEMAS = {
  build: {
    required: ['type'],
    optional: ['block', 'height', 'width', 'size', 'length', 'schematic'],
    types: ['tower', 'wall', 'cube', 'floor', 'pyramid', 'schematic'],
  },
  mine: {
    required: [],
    optional: ['radius', 'oreTypes', 'maxClusters'],
  },
  navigate: {
    required: ['x', 'y', 'z'],
    optional: ['range'],
  },
  follow: {
    required: ['target'],
    optional: ['range'],
  },
  chat: {
    required: ['message'],
    optional: [],
  },
  stop: {
    required: [],
    optional: [],
  },
  scan: {
    required: [],
    optional: ['radius', 'oreTypes'],
  },
  equip: {
    required: ['item'],
    optional: ['destination'],
  },
  craft: {
    required: ['item'],
    optional: ['count'],
  },
}

/**
 * Parse an LLM response string into a structured command object.
 * Handles JSON in code blocks, raw JSON, or wrapped in text.
 * @param {string} llmResponse - Raw LLM output
 * @returns {object} Parsed command with success, action, params, or error
 */
function parseCommand(llmResponse) {
  let jsonStr = llmResponse

  const jsonMatch = llmResponse.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  } else {
    const braceMatch = llmResponse.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      jsonStr = braceMatch[0]
    }
  }

  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse JSON: ${err.message}`,
      raw: llmResponse,
    }
  }

  if (!parsed.action) {
    return {
      success: false,
      error: 'Missing required field: action',
      raw: llmResponse,
    }
  }

  if (!VALID_ACTIONS.includes(parsed.action)) {
    return {
      success: false,
      error: `Invalid action: ${parsed.action}. Valid actions: ${VALID_ACTIONS.join(', ')}`,
      raw: llmResponse,
    }
  }

  const validation = validateParams(parsed.action, parsed.params || {})
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      raw: llmResponse,
    }
  }

  return {
    success: true,
    action: parsed.action,
    params: parsed.params || {},
    message: parsed.message || null,
  }
}

/**
 * Validate parameters for a given action against its schema.
 * @param {string} action - Action type
 * @param {object} params - Parameters to validate
 * @returns {object} { valid: boolean, error?: string }
 */
function validateParams(action, params) {
  const schema = ACTION_SCHEMAS[action]
  if (!schema) {
    return { valid: false, error: `No schema for action: ${action}` }
  }

  for (const field of schema.required) {
    if (params[field] === undefined || params[field] === null) {
      return { valid: false, error: `Missing required param for '${action}': ${field}` }
    }
  }

  if (action === 'build' && schema.types && params.type) {
    if (!schema.types.includes(params.type)) {
      return {
        valid: false,
        error: `Invalid build type: ${params.type}. Valid types: ${schema.types.join(', ')}`,
      }
    }
  }

  if (action === 'navigate') {
    if (typeof params.x !== 'number' || typeof params.y !== 'number' || typeof params.z !== 'number') {
      return { valid: false, error: 'navigate params x, y, z must be numbers' }
    }
  }

  return { valid: true }
}

module.exports = { parseCommand, validateParams, VALID_ACTIONS, ACTION_SCHEMAS }
