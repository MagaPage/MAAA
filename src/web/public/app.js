/* eslint-env browser */
/* global io */

const socket = io()

const elements = {
  connectionStatus: document.getElementById('connectionStatus'),
  position: document.getElementById('position'),
  healthBar: document.getElementById('healthBar'),
  healthText: document.getElementById('healthText'),
  foodBar: document.getElementById('foodBar'),
  foodText: document.getElementById('foodText'),
  dimension: document.getElementById('dimension'),
  leashDistance: document.getElementById('leashDistance'),
  inventoryList: document.getElementById('inventoryList'),
  commandInput: document.getElementById('commandInput'),
  sendCommand: document.getElementById('sendCommand'),
  currentTask: document.getElementById('currentTask'),
  taskAction: document.getElementById('taskAction'),
  taskProgress: document.getElementById('taskProgress'),
  logContainer: document.getElementById('logContainer'),
}

function updateStatus(state) {
  if (!state) return

  if (state.position) {
    elements.position.textContent =
      `(${state.position.x}, ${state.position.y}, ${state.position.z})`
  }

  if (state.health !== undefined) {
    const healthPct = (state.health / 20) * 100
    elements.healthBar.style.width = `${healthPct}%`
    elements.healthText.textContent = `${Math.floor(state.health)}/20`
  }

  if (state.food !== undefined) {
    const foodPct = (state.food / 20) * 100
    elements.foodBar.style.width = `${foodPct}%`
    elements.foodText.textContent = `${state.food}/20`
  }

  if (state.dimension) {
    elements.dimension.textContent = state.dimension
  }

  if (state.inventory) {
    updateInventory(state.inventory)
  }
}

function updateInventory(items) {
  if (!items || items.length === 0) {
    elements.inventoryList.innerHTML = '<p class="empty">No items</p>'
    return
  }

  elements.inventoryList.innerHTML = items
    .map(item =>
      `<div class="inventory-item">${item.name} <span class="count">x${item.count}</span></div>`
    )
    .join('')
}

function addLog(type, message) {
  const entry = document.createElement('div')
  entry.className = `log-entry ${type}`

  const time = new Date().toLocaleTimeString()
  entry.innerHTML = `<span class="timestamp">${time}</span>${escapeHtml(message)}`

  elements.logContainer.appendChild(entry)
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

async function sendCommand() {
  const message = elements.commandInput.value.trim()
  if (!message) return

  elements.commandInput.value = ''
  elements.sendCommand.disabled = true
  addLog('info', `> ${message}`)

  try {
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })

    const data = await response.json()

    if (!response.ok) {
      addLog('error', `Error: ${data.error || 'Unknown error'}`)
    } else {
      addLog('info', `Command parsed: ${data.command.action}`)
      if (data.result) {
        addLog('info', `Result: ${JSON.stringify(data.result)}`)
      }
    }
  } catch (err) {
    addLog('error', `Network error: ${err.message}`)
  } finally {
    elements.sendCommand.disabled = false
  }
}

elements.sendCommand.addEventListener('click', sendCommand)
elements.commandInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCommand()
})

socket.on('connect', () => {
  elements.connectionStatus.textContent = 'Connected'
  elements.connectionStatus.className = 'status connected'
  addLog('info', 'Connected to dashboard server')
})

socket.on('disconnect', () => {
  elements.connectionStatus.textContent = 'Disconnected'
  elements.connectionStatus.className = 'status disconnected'
  addLog('warn', 'Disconnected from dashboard server')
})

socket.on('botState', (state) => {
  updateStatus(state)
  addLog('info', 'Bot state updated')
})

socket.on('botPosition', (pos) => {
  elements.position.textContent = `(${pos.x}, ${pos.y}, ${pos.z})`
})

socket.on('healthUpdate', (health) => {
  const healthPct = (health.health / 20) * 100
  elements.healthBar.style.width = `${healthPct}%`
  elements.healthText.textContent = `${Math.floor(health.health)}/20`

  const foodPct = (health.food / 20) * 100
  elements.foodBar.style.width = `${foodPct}%`
  elements.foodText.textContent = `${health.food}/20`
})

socket.on('taskStart', (task) => {
  elements.currentTask.classList.remove('hidden')
  elements.taskAction.textContent = `Running: ${task.action}`
  elements.taskProgress.style.width = '0%'
})

socket.on('taskProgress', (progress) => {
  if (progress.total) {
    const pct = (progress.placed / progress.total) * 100
    elements.taskProgress.style.width = `${pct}%`
    elements.taskAction.textContent = `${progress.action}: ${progress.placed || 0}/${progress.total}`
  }
})

socket.on('taskComplete', (_result) => {
  elements.currentTask.classList.add('hidden')
  elements.taskProgress.style.width = '0%'
})

socket.on('taskError', (error) => {
  elements.currentTask.classList.add('hidden')
  addLog('error', `Task error: ${error.error}`)
})

socket.on('log', (data) => {
  addLog(data.type || 'info', data.message)
})

async function refreshStatus() {
  try {
    const response = await fetch('/api/status')
    if (response.ok) {
      const state = await response.json()
      updateStatus(state)

      if (state.leash) {
        elements.leashDistance.textContent =
          `${state.leash.currentDistance}/${state.leash.maxDistance} (${state.leash.enabled ? 'ON' : 'OFF'})`
      }
    }
  } catch {
    // Server not reachable
  }
}

setInterval(refreshStatus, 5000)
