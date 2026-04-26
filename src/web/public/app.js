/* eslint-env browser */
/* global io */

const socket = io()

// ========== DOM Elements ==========
const el = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  mobileMenu: document.getElementById('mobileMenu'),
  themeToggle: document.getElementById('themeToggle'),
  connectionStatus: document.getElementById('connectionStatus'),
  pageTitle: document.getElementById('pageTitle'),
  notifBadge: document.getElementById('notifBadge'),
  // Overview
  botStatusBadge: document.getElementById('botStatusBadge'),
  healthBar: document.getElementById('healthBar'),
  healthText: document.getElementById('healthText'),
  foodBar: document.getElementById('foodBar'),
  foodText: document.getElementById('foodText'),
  posX: document.getElementById('posX'),
  posY: document.getElementById('posY'),
  posZ: document.getElementById('posZ'),
  dimension: document.getElementById('dimension'),
  leashDistance: document.getElementById('leashDistance'),
  currentTaskDisplay: document.getElementById('currentTaskDisplay'),
  recentLog: document.getElementById('recentLog'),
  // Quick Command (overview)
  quickCommandInput: document.getElementById('quickCommandInput'),
  quickSendBtn: document.getElementById('quickSendBtn'),
  quickTaskStatus: document.getElementById('quickTaskStatus'),
  quickTaskAction: document.getElementById('quickTaskAction'),
  quickTaskProgress: document.getElementById('quickTaskProgress'),
  // Command page
  commandInput: document.getElementById('commandInput'),
  sendCommand: document.getElementById('sendCommand'),
  commandHistory: document.getElementById('commandHistory'),
  currentTask: document.getElementById('currentTask'),
  taskAction: document.getElementById('taskAction'),
  taskProgress: document.getElementById('taskProgress'),
  // Inventory
  inventoryGrid: document.getElementById('inventoryGrid'),
  itemCount: document.getElementById('itemCount'),
  // Logs
  logContainer: document.getElementById('logContainer'),
  logFilter: document.getElementById('logFilter'),
  clearLogs: document.getElementById('clearLogs'),
  // Integrations
  discordWebhookUrl: document.getElementById('discordWebhookUrl'),
  discordChannelId: document.getElementById('discordChannelId'),
  discordNotifyCommands: document.getElementById('discordNotifyCommands'),
  discordNotifyErrors: document.getElementById('discordNotifyErrors'),
  discordNotifyTasks: document.getElementById('discordNotifyTasks'),
  discordSave: document.getElementById('discordSave'),
  discordTest: document.getElementById('discordTest'),
  discordToggle: document.getElementById('discordToggle'),
  discordStatus: document.getElementById('discordStatus'),
  telegramBotToken: document.getElementById('telegramBotToken'),
  telegramChatId: document.getElementById('telegramChatId'),
  telegramNotifyCommands: document.getElementById('telegramNotifyCommands'),
  telegramNotifyErrors: document.getElementById('telegramNotifyErrors'),
  telegramNotifyTasks: document.getElementById('telegramNotifyTasks'),
  telegramSave: document.getElementById('telegramSave'),
  telegramTest: document.getElementById('telegramTest'),
  telegramToggle: document.getElementById('telegramToggle'),
  telegramStatus: document.getElementById('telegramStatus'),
  // Settings
  leashMaxDistance: document.getElementById('leashMaxDistance'),
  leashEnabled: document.getElementById('leashEnabled'),
  saveLeash: document.getElementById('saveLeash'),
  resetOrigin: document.getElementById('resetOrigin'),
  disconnectBot: document.getElementById('disconnectBot'),
  // Modal
  shortcutsModal: document.getElementById('shortcutsModal'),
  closeShortcuts: document.getElementById('closeShortcuts'),
  // Toast
  toastContainer: document.getElementById('toastContainer'),
}

// ========== State ==========
const logEntries = []
let commandWelcomeShown = true

// ========== Theme ==========
function initTheme() {
  const saved = localStorage.getItem('maaa-theme') || 'dark'
  document.documentElement.setAttribute('data-theme', saved)
}

el.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('maaa-theme', next)
})

initTheme()

// ========== Sidebar ==========
el.sidebarToggle.addEventListener('click', () => {
  el.sidebar.classList.toggle('collapsed')
  localStorage.setItem('maaa-sidebar', el.sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded')
})

el.mobileMenu.addEventListener('click', () => {
  el.sidebar.classList.toggle('mobile-open')
})

if (localStorage.getItem('maaa-sidebar') === 'collapsed') {
  el.sidebar.classList.add('collapsed')
}

// ========== Page Navigation ==========
const navItems = document.querySelectorAll('.nav-item')
const pages = document.querySelectorAll('.page')
const pageNames = { overview: 'Overview', command: 'Command Center', inventory: 'Inventory', integrations: 'Integrations', logs: 'Activity Log', settings: 'Settings' }

function switchPage(pageName) {
  navItems.forEach(n => n.classList.remove('active'))
  pages.forEach(p => p.classList.remove('active'))

  const navItem = document.querySelector(`.nav-item[data-page="${pageName}"]`)
  const page = document.getElementById(`page-${pageName}`)

  if (navItem) navItem.classList.add('active')
  if (page) page.classList.add('active')
  el.pageTitle.textContent = pageNames[pageName] || pageName

  el.sidebar.classList.remove('mobile-open')
}

navItems.forEach(item => {
  item.addEventListener('click', () => switchPage(item.dataset.page))
})

document.getElementById('viewAllLogs')?.addEventListener('click', () => switchPage('logs'))
document.getElementById('goToIntegrations')?.addEventListener('click', () => switchPage('integrations'))

// ========== Keyboard Shortcuts ==========
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return

  const shortcuts = { '1': 'overview', '2': 'command', '3': 'inventory', '4': 'integrations', '5': 'logs', '6': 'settings' }

  if (shortcuts[e.key]) {
    e.preventDefault()
    switchPage(shortcuts[e.key])
  }

  if (e.key === '/') {
    e.preventDefault()
    switchPage('command')
    setTimeout(() => el.commandInput.focus(), 100)
  }

  if (e.key === '?') {
    e.preventDefault()
    el.shortcutsModal.classList.toggle('active')
  }

  if (e.key === 'Escape') {
    el.shortcutsModal.classList.remove('active')
  }
})

el.closeShortcuts.addEventListener('click', () => {
  el.shortcutsModal.classList.remove('active')
})

document.querySelector('.keyboard-hint')?.addEventListener('click', () => {
  el.shortcutsModal.classList.add('active')
})

// ========== Toast Notifications ==========
function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  el.toastContainer.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}

// ========== Status Updates ==========
function updateStatus(state) {
  if (!state) return

  el.botStatusBadge.textContent = 'Online'
  el.botStatusBadge.classList.add('online')

  if (state.position) {
    el.posX.textContent = state.position.x
    el.posY.textContent = state.position.y
    el.posZ.textContent = state.position.z
  }

  if (state.health !== undefined) {
    const healthPct = (state.health / 20) * 100
    el.healthBar.style.width = `${healthPct}%`
    el.healthText.textContent = `${Math.floor(state.health)}/20`
  }

  if (state.food !== undefined) {
    const foodPct = (state.food / 20) * 100
    el.foodBar.style.width = `${foodPct}%`
    el.foodText.textContent = `${state.food}/20`
  }

  if (state.dimension) {
    el.dimension.textContent = state.dimension
  }

  if (state.inventory) {
    updateInventory(state.inventory)
  }
}

function updateInventory(items) {
  if (!items || items.length === 0) {
    el.inventoryGrid.innerHTML = `
      <div class="inventory-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span>No items in inventory</span>
      </div>`
    el.itemCount.textContent = '0 items'
    return
  }

  el.inventoryGrid.innerHTML = items.map(item =>
    `<div class="inventory-slot">
      <span class="item-name">${escapeHtml(item.name)}</span>
      <span class="item-count">x${item.count}</span>
    </div>`
  ).join('')
  el.itemCount.textContent = `${items.length} items`
}

// ========== Logging ==========
function addLog(type, message) {
  const time = new Date().toLocaleTimeString()
  const entry = { type, message, time }
  logEntries.push(entry)

  addLogToRecent(entry)
  addLogToFull(entry)
}

function addLogToRecent(entry) {
  const item = document.createElement('div')
  item.className = `log-item log-${entry.type}`
  item.innerHTML = `<span class="log-dot"></span><span class="log-msg">${escapeHtml(entry.message)}</span><span class="log-time">${entry.time}</span>`
  el.recentLog.appendChild(item)
  el.recentLog.scrollTop = el.recentLog.scrollHeight

  while (el.recentLog.children.length > 20) {
    el.recentLog.removeChild(el.recentLog.firstChild)
  }
}

function addLogToFull(entry) {
  const item = document.createElement('div')
  item.className = `log-item log-${entry.type}`
  item.dataset.type = entry.type
  item.innerHTML = `<span class="log-dot"></span><span class="log-time-full">${entry.time}</span><span class="log-msg">${escapeHtml(entry.message)}</span>`
  el.logContainer.appendChild(item)
  el.logContainer.scrollTop = el.logContainer.scrollHeight
}

el.logFilter.addEventListener('change', () => {
  const filter = el.logFilter.value
  el.logContainer.querySelectorAll('.log-item').forEach(item => {
    if (filter === 'all' || item.dataset.type === filter) {
      item.style.display = ''
    } else {
      item.style.display = 'none'
    }
  })
})

el.clearLogs.addEventListener('click', () => {
  el.logContainer.innerHTML = ''
  el.recentLog.innerHTML = ''
  logEntries.length = 0
  showToast('Logs cleared', 'info')
})

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ========== Command Sending ==========
async function sendCommand(message, inputEl, sendBtn) {
  if (!message) return

  inputEl.value = ''
  sendBtn.disabled = true

  if (commandWelcomeShown) {
    el.commandHistory.innerHTML = ''
    commandWelcomeShown = false
  }

  const userBubble = document.createElement('div')
  userBubble.className = 'cmd-bubble user'
  userBubble.textContent = message
  el.commandHistory.appendChild(userBubble)
  el.commandHistory.scrollTop = el.commandHistory.scrollHeight

  addLog('info', `> ${message}`)

  try {
    const response = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorBubble = document.createElement('div')
      errorBubble.className = 'cmd-bubble error'
      errorBubble.textContent = `Error: ${data.error || 'Unknown error'}`
      el.commandHistory.appendChild(errorBubble)
      addLog('error', `Error: ${data.error || 'Unknown error'}`)
    } else {
      const botBubble = document.createElement('div')
      botBubble.className = 'cmd-bubble bot'
      botBubble.textContent = `Command: ${data.command.action}${data.result ? ` — ${JSON.stringify(data.result)}` : ''}`
      el.commandHistory.appendChild(botBubble)
      addLog('info', `Command parsed: ${data.command.action}`)
      if (data.result) {
        addLog('info', `Result: ${JSON.stringify(data.result)}`)
      }
    }
  } catch (err) {
    const errorBubble = document.createElement('div')
    errorBubble.className = 'cmd-bubble error'
    errorBubble.textContent = `Network error: ${err.message}`
    el.commandHistory.appendChild(errorBubble)
    addLog('error', `Network error: ${err.message}`)
  } finally {
    sendBtn.disabled = false
    el.commandHistory.scrollTop = el.commandHistory.scrollHeight
  }
}

// Command page
el.sendCommand.addEventListener('click', () => {
  sendCommand(el.commandInput.value.trim(), el.commandInput, el.sendCommand)
})

el.commandInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCommand(el.commandInput.value.trim(), el.commandInput, el.sendCommand)
})

// Quick command (overview)
el.quickSendBtn.addEventListener('click', () => {
  sendCommand(el.quickCommandInput.value.trim(), el.quickCommandInput, el.quickSendBtn)
})

el.quickCommandInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendCommand(el.quickCommandInput.value.trim(), el.quickCommandInput, el.quickSendBtn)
})

// Example commands
document.querySelectorAll('.example-cmd').forEach(btn => {
  btn.addEventListener('click', () => {
    el.commandInput.value = btn.dataset.cmd
    el.commandInput.focus()
  })
})

// ========== Socket.io Events ==========
socket.on('connect', () => {
  el.connectionStatus.classList.add('connected')
  el.connectionStatus.querySelector('.connection-text').textContent = 'Connected'
  addLog('info', 'Connected to dashboard server')
})

socket.on('disconnect', () => {
  el.connectionStatus.classList.remove('connected')
  el.connectionStatus.querySelector('.connection-text').textContent = 'Disconnected'
  el.botStatusBadge.textContent = 'Offline'
  el.botStatusBadge.classList.remove('online')
  addLog('warn', 'Disconnected from dashboard server')
})

socket.on('botState', (state) => {
  updateStatus(state)
  addLog('info', 'Bot state updated')
})

socket.on('botPosition', (pos) => {
  el.posX.textContent = pos.x
  el.posY.textContent = pos.y
  el.posZ.textContent = pos.z
})

socket.on('healthUpdate', (health) => {
  const healthPct = (health.health / 20) * 100
  el.healthBar.style.width = `${healthPct}%`
  el.healthText.textContent = `${Math.floor(health.health)}/20`

  const foodPct = (health.food / 20) * 100
  el.foodBar.style.width = `${foodPct}%`
  el.foodText.textContent = `${health.food}/20`
})

socket.on('taskStart', (task) => {
  el.currentTask.classList.remove('hidden')
  el.taskAction.textContent = `Running: ${task.action}`
  el.taskProgress.style.width = '0%'

  el.quickTaskStatus.classList.remove('hidden')
  el.quickTaskAction.textContent = `Running: ${task.action}`
  el.quickTaskProgress.style.width = '0%'

  el.currentTaskDisplay.innerHTML = `
    <div class="task-info">
      <span class="task-pulse"></span>
      <span>Running: ${escapeHtml(task.action)}</span>
    </div>`
})

socket.on('taskProgress', (progress) => {
  if (progress.total) {
    const pct = (progress.placed / progress.total) * 100
    el.taskProgress.style.width = `${pct}%`
    el.quickTaskProgress.style.width = `${pct}%`
    el.taskAction.textContent = `${progress.action}: ${progress.placed || 0}/${progress.total}`
    el.quickTaskAction.textContent = `${progress.action}: ${progress.placed || 0}/${progress.total}`
  }
})

socket.on('taskComplete', (_result) => {
  el.currentTask.classList.add('hidden')
  el.taskProgress.style.width = '0%'
  el.quickTaskStatus.classList.add('hidden')
  el.quickTaskProgress.style.width = '0%'
  el.currentTaskDisplay.innerHTML = `
    <div class="task-idle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>Idle — no active task</span>
    </div>`
})

socket.on('taskError', (error) => {
  el.currentTask.classList.add('hidden')
  el.quickTaskStatus.classList.add('hidden')
  addLog('error', `Task error: ${error.error}`)
})

socket.on('log', (data) => {
  addLog(data.type || 'info', data.message)
})

// ========== Status Polling ==========
async function refreshStatus() {
  try {
    const response = await fetch('/api/status')
    if (response.ok) {
      const state = await response.json()
      updateStatus(state)

      if (state.leash) {
        el.leashDistance.textContent =
          `${state.leash.currentDistance}/${state.leash.maxDistance} (${state.leash.enabled ? 'ON' : 'OFF'})`
        el.leashMaxDistance.value = state.leash.maxDistance
        el.leashEnabled.checked = state.leash.enabled
      }
    }
  } catch {
    // Server not reachable
  }
}

setInterval(refreshStatus, 5000)

// ========== Settings ==========
el.saveLeash.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/leash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxDistance: parseInt(el.leashMaxDistance.value, 10),
        enabled: el.leashEnabled.checked,
      }),
    })
    if (response.ok) {
      showToast('Leash settings saved', 'success')
    } else {
      showToast('Failed to save leash settings', 'error')
    }
  } catch {
    showToast('Network error', 'error')
  }
})

el.resetOrigin.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/leash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ override: true }),
    })
    if (response.ok) {
      showToast('Origin reset to current position', 'success')
    }
  } catch {
    showToast('Network error', 'error')
  }
})

el.disconnectBot.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/disconnect', { method: 'POST' })
    const data = await response.json()
    showToast(data.message || data.error, response.ok ? 'info' : 'error')
  } catch {
    showToast('Network error', 'error')
  }
})

// ========== Integrations ==========
function loadIntegrationSettings() {
  try {
    const discord = JSON.parse(localStorage.getItem('maaa-discord') || 'null')
    if (discord) {
      el.discordWebhookUrl.value = discord.webhookUrl || ''
      el.discordChannelId.value = discord.channelId || ''
      el.discordNotifyCommands.checked = discord.notifyCommands !== false
      el.discordNotifyErrors.checked = discord.notifyErrors !== false
      el.discordNotifyTasks.checked = discord.notifyTasks === true
      el.discordToggle.checked = discord.enabled === true
      el.discordToggle.disabled = false
      el.discordStatus.textContent = discord.enabled ? 'Connected' : 'Configured'
    }

    const telegram = JSON.parse(localStorage.getItem('maaa-telegram') || 'null')
    if (telegram) {
      el.telegramBotToken.value = telegram.botToken || ''
      el.telegramChatId.value = telegram.chatId || ''
      el.telegramNotifyCommands.checked = telegram.notifyCommands !== false
      el.telegramNotifyErrors.checked = telegram.notifyErrors !== false
      el.telegramNotifyTasks.checked = telegram.notifyTasks === true
      el.telegramToggle.checked = telegram.enabled === true
      el.telegramToggle.disabled = false
      el.telegramStatus.textContent = telegram.enabled ? 'Connected' : 'Configured'
    }
  } catch {
    // Ignore parse errors
  }
}

el.discordSave.addEventListener('click', async () => {
  const config = {
    webhookUrl: el.discordWebhookUrl.value.trim(),
    channelId: el.discordChannelId.value.trim(),
    notifyCommands: el.discordNotifyCommands.checked,
    notifyErrors: el.discordNotifyErrors.checked,
    notifyTasks: el.discordNotifyTasks.checked,
    enabled: true,
  }

  if (!config.webhookUrl) {
    showToast('Webhook URL is required', 'error')
    return
  }

  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/.test(config.webhookUrl)) {
    showToast('Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/', 'error')
    return
  }

  try {
    const response = await fetch('/api/integrations/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })

    if (response.ok) {
      localStorage.setItem('maaa-discord', JSON.stringify(config))
      el.discordToggle.checked = true
      el.discordToggle.disabled = false
      el.discordStatus.textContent = 'Connected'
      showToast('Discord integration saved', 'success')
    } else {
      const data = await response.json()
      showToast(data.error || 'Failed to save', 'error')
    }
  } catch {
    localStorage.setItem('maaa-discord', JSON.stringify(config))
    el.discordToggle.checked = true
    el.discordToggle.disabled = false
    el.discordStatus.textContent = 'Connected'
    showToast('Discord settings saved locally', 'info')
  }
})

el.discordTest.addEventListener('click', async () => {
  const webhookUrl = el.discordWebhookUrl.value.trim()
  if (!webhookUrl) {
    showToast('Enter a webhook URL first', 'error')
    return
  }

  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/.test(webhookUrl)) {
    showToast('Invalid Discord webhook URL format', 'error')
    return
  }

  try {
    const response = await fetch('/api/integrations/discord/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    })

    if (response.ok) {
      showToast('Test message sent to Discord', 'success')
    } else {
      showToast('Failed to send test message', 'error')
    }
  } catch {
    showToast('Server not reachable — test webhook directly', 'info')
  }
})

el.telegramSave.addEventListener('click', async () => {
  const config = {
    botToken: el.telegramBotToken.value.trim(),
    chatId: el.telegramChatId.value.trim(),
    notifyCommands: el.telegramNotifyCommands.checked,
    notifyErrors: el.telegramNotifyErrors.checked,
    notifyTasks: el.telegramNotifyTasks.checked,
    enabled: true,
  }

  if (!config.botToken || !config.chatId) {
    showToast('Bot token and Chat ID are required', 'error')
    return
  }

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(config.botToken)) {
    showToast('Invalid bot token format. Get your token from @BotFather on Telegram', 'error')
    return
  }

  if (!/^-?\d{1,20}$/.test(config.chatId)) {
    showToast('Invalid Chat ID format. Must be a numeric ID', 'error')
    return
  }

  try {
    const response = await fetch('/api/integrations/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })

    if (response.ok) {
      localStorage.setItem('maaa-telegram', JSON.stringify(config))
      el.telegramToggle.checked = true
      el.telegramToggle.disabled = false
      el.telegramStatus.textContent = 'Connected'
      showToast('Telegram integration saved', 'success')
    } else {
      const data = await response.json()
      showToast(data.error || 'Failed to save', 'error')
    }
  } catch {
    localStorage.setItem('maaa-telegram', JSON.stringify(config))
    el.telegramToggle.checked = true
    el.telegramToggle.disabled = false
    el.telegramStatus.textContent = 'Connected'
    showToast('Telegram settings saved locally', 'info')
  }
})

el.telegramTest.addEventListener('click', async () => {
  const botToken = el.telegramBotToken.value.trim()
  const chatId = el.telegramChatId.value.trim()
  if (!botToken || !chatId) {
    showToast('Enter bot token and chat ID first', 'error')
    return
  }

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(botToken)) {
    showToast('Invalid bot token format', 'error')
    return
  }

  try {
    const response = await fetch('/api/integrations/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId }),
    })

    if (response.ok) {
      showToast('Test message sent to Telegram', 'success')
    } else {
      showToast('Failed to send test message', 'error')
    }
  } catch {
    showToast('Server not reachable — check bot token', 'info')
  }
})

loadIntegrationSettings()
