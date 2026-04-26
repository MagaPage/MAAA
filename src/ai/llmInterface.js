const OpenAI = require('openai')
const { parseCommand } = require('./commandParser')

const SYSTEM_PROMPT = `You are the AI brain of a Minecraft bot called MAAA (Minecraft AI Architect & Automator).
Your job is to interpret natural language commands and convert them into structured JSON actions.

You MUST respond with a single JSON object (no markdown, no explanation) with this structure:
{
  "action": "<action_type>",
  "params": { ... },
  "message": "<optional message to say in chat>"
}

Available actions and their params:

1. "build" - Build a structure
   params: { "type": "tower|wall|cube|floor|pyramid|schematic", "block": "block_name", "height": N, "width": N, "size": N, "length": N }

2. "mine" - Mine ore clusters
   params: { "radius": N, "oreTypes": ["ore_name", ...], "maxClusters": N }

3. "navigate" - Move to coordinates
   params: { "x": N, "y": N, "z": N, "range": N }

4. "follow" - Follow a player or entity
   params: { "target": "player_name", "range": N }

5. "chat" - Say something in game chat
   params: { "message": "text" }

6. "stop" - Stop current activity
   params: {}

7. "scan" - Scan for ores nearby
   params: { "radius": N, "oreTypes": ["ore_name", ...] }

8. "equip" - Equip an item
   params: { "item": "item_name", "destination": "hand|head|torso|legs|feet" }

9. "craft" - Craft an item
   params: { "item": "item_name", "count": N }

Rules:
- Always use the bot's current inventory when deciding what blocks to use
- For building, default to "cobblestone" if no block is specified
- For mining, default radius is 32
- Coordinates should be integers
- If the command is unclear, use "chat" action to ask for clarification`

class LLMInterface {
  /**
   * Interface with OpenAI GPT models for command interpretation.
   * @param {string} apiKey - OpenAI API key
   * @param {string} [model='gpt-4o'] - Model name
   * @param {number} [maxContextTokens=8000] - Max token budget for conversation history
   */
  constructor(apiKey, model = 'gpt-4o', maxContextTokens = 8000) {
    this.client = new OpenAI({ apiKey })
    this.model = model
    this.history = []
    this.maxContextTokens = maxContextTokens
  }

  /**
   * Process a single command without history.
   * @param {string} userMessage - Natural language command
   * @param {string} botContext - Bot state context
   * @returns {Promise<object>} Parsed command result
   */
  async processCommand(userMessage, botContext) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Current bot state:\n${botContext}` },
      { role: 'user', content: userMessage },
    ]

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content || ''
    return parseCommand(content)
  }

  /**
   * Process a command with conversation history, trimming to stay within token budget.
   * @param {string} userMessage - Natural language command
   * @param {string} botContext - Bot state context
   * @returns {Promise<object>} Parsed command result
   */
  async processWithHistory(userMessage, botContext) {
    this.history.push({ role: 'user', content: userMessage })
    this._trimHistory()

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Current bot state:\n${botContext}` },
      ...this.history,
    ]

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content || ''
    this.history.push({ role: 'assistant', content })
    this._trimHistory()

    return parseCommand(content)
  }

  /**
   * Trim conversation history to stay within the token budget.
   * Estimates ~4 chars per token (conservative for English text).
   */
  _trimHistory() {
    const CHARS_PER_TOKEN = 4
    const maxChars = this.maxContextTokens * CHARS_PER_TOKEN

    let totalChars = this.history.reduce((sum, msg) => sum + msg.content.length, 0)

    while (totalChars > maxChars && this.history.length > 2) {
      const removed = this.history.shift()
      totalChars -= removed.content.length
    }
  }

  /**
   * Clear conversation history.
   */
  resetHistory() {
    this.history = []
  }
}

module.exports = { LLMInterface, SYSTEM_PROMPT }
