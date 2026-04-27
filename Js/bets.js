import {
  getAllMatchesFlat,
  getAllMatchResults,
  getBetLocks,
  getPredictionStatsByMatch,
  getUserProfile,
  getUserPredictions,
  isAdminUser,
  makeBatchPredictions,
  onAuthChange,
  logOut,
  setUserNickname,
  updateUserEmail,
  updateUserPassword
} from './firebase.js'
import { initI18n, onLanguageChange, t, translateTeamName } from './i18n.js'

const matchesContainer = document.getElementById('matches')
const compactToggle = document.getElementById('compactToggle')
const betsPanel = document.getElementById('betsPanel')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')

let allMatches = []
let userPredictions = {} // Saved predictions from Firebase
let tempPredictions = {} // Local predictions awaiting submission
let allResults = {}
let predictionStatsByMatch = {}
let betLocks = { matchesLockedAt: '', winnerLockedAt: '' }
let currentUser = null
let isAdmin = false
let isSubmitting = false
let roundCollapsed = {}
const COMPACT_MODE_KEY = 'betsCompactMode'
const PREDICTIONS_PANEL_COLLAPSED_KEY = 'betsPredictionsCollapsed'
let compactMode = window.localStorage.getItem(COMPACT_MODE_KEY) !== 'off'
let predictionsPanelCollapsed =
  window.localStorage.getItem(PREDICTIONS_PANEL_COLLAPSED_KEY) === 'on'

initI18n()

const updateCompactToggleLabel = () => {
  if (!compactToggle) return
  compactToggle.textContent = compactMode
    ? t('bets.compactOn')
    : t('bets.compactOff')
}

const updatePredictionsPanelToggleLabel = () => {
  const toggleBtn = document.getElementById('betsPanelToggleBtn')
  if (!toggleBtn) return

  toggleBtn.textContent = predictionsPanelCollapsed
    ? t('bets.expandPredictions')
    : t('bets.collapsePredictions')
  toggleBtn.setAttribute('aria-expanded', String(!predictionsPanelCollapsed))
}

const applyPredictionsPanelState = () => {
  if (!betsPanel) return

  betsPanel.classList.toggle('collapsed', predictionsPanelCollapsed)
  updatePredictionsPanelToggleLabel()
}

const attachPredictionsPanelToggle = () => {
  const toggleBtn = document.getElementById('betsPanelToggleBtn')
  if (!toggleBtn) return

  toggleBtn.addEventListener('click', () => {
    predictionsPanelCollapsed = !predictionsPanelCollapsed
    window.localStorage.setItem(
      PREDICTIONS_PANEL_COLLAPSED_KEY,
      predictionsPanelCollapsed ? 'on' : 'off'
    )
    applyPredictionsPanelState()
  })
}

const applyCompactMode = () => {
  document.body.classList.toggle('compact-mode', compactMode)
  updateCompactToggleLabel()
}

applyCompactMode()

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

const updateAdminTabVisibility = async user => {
  const admin = await isAdminUser(user)
  isAdmin = admin
  document.body.classList.toggle('is-admin', admin)
  if (adminNavLink) adminNavLink.style.display = admin ? '' : 'none'
}

const isMatchLocked = matchId => Boolean(allResults[matchId]?.winner)

const isMatchBetLockedByAdmin = () => {
  const lockAt = String(betLocks.matchesLockedAt || '')
  if (!lockAt) return false

  const lockTime = new Date(lockAt).getTime()
  if (Number.isNaN(lockTime)) return false
  return Date.now() >= lockTime
}

const isBetLockedForMatch = matchId =>
  isMatchLocked(matchId) || isMatchBetLockedByAdmin()

const getUnlockedMatches = () =>
  allMatches.filter(match => !isBetLockedForMatch(match.id))

const getRequiredPredictionCount = () => getUnlockedMatches().length

const attachAccountSettingsModal = async profile => {
  const modal = document.getElementById('accountSettingsModal')
  const backdrop = document.getElementById('accountModalBackdrop')
  const form = document.getElementById('accountForm')
  const closeButtons = document.querySelectorAll('.account-modal-close')
  const messageDiv = document.getElementById('accountMessage')
  const nicknameInput = document.getElementById('accountNickname')
  const emailInput = document.getElementById('accountEmail')
  const passwordInput = document.getElementById('accountPassword')

  if (!modal || !form) return

  const showMessage = (text, type = 'success') => {
    messageDiv.textContent = text
    messageDiv.className = `account-message ${type}`
    messageDiv.style.display = 'block'
  }

  const hideMessage = () => {
    messageDiv.style.display = 'none'
  }

  const closeModal = () => {
    modal.style.display = 'none'
    backdrop.style.display = 'none'
    hideMessage()
  }

  const openModal = async () => {
    if (!currentUser) return

    const userProfile = await getUserProfile(currentUser.uid)
    nicknameInput.value = userProfile?.nickname || ''
    emailInput.value = currentUser.email || ''
    passwordInput.value = ''

    modal.style.display = 'block'
    backdrop.style.display = 'block'
    hideMessage()
  }

  userEmail.style.cursor = 'pointer'
  userEmail.title = t('nickname.clickToChange')
  userEmail.onclick = openModal

  closeButtons.forEach(btn => {
    btn.onclick = closeModal
  })

  backdrop.onclick = closeModal

  form.onsubmit = async e => {
    e.preventDefault()

    if (!currentUser) {
      showMessage(t('common.logoutFailed'), 'error')
      return
    }

    const nickname = nicknameInput.value.trim()
    const email = emailInput.value.trim()
    const password = passwordInput.value.trim()

    if (!nickname) {
      showMessage(t('nickname.empty'), 'error')
      return
    }

    try {
      let errorOccurred = false

      // Update nickname
      try {
        await setUserNickname(currentUser.uid, nickname)
      } catch (err) {
        console.error('Nickname update failed:', err)
        errorOccurred = true
      }

      // Update email if changed
      if (email && email !== currentUser.email) {
        try {
          await updateUserEmail(currentUser, email)
        } catch (err) {
          console.error('Email update failed:', err)
          showMessage(err.message || t('account.updateError'), 'error')
          return
        }
      }

      // Update password if provided
      if (password) {
        try {
          await updateUserPassword(currentUser, password)
        } catch (err) {
          console.error('Password update failed:', err)
          showMessage(err.message || t('account.updateError'), 'error')
          return
        }
      }

      showMessage(t('account.updateSuccess'), 'success')
      userEmail.textContent = nickname
      setTimeout(closeModal, 1500)
    } catch (error) {
      console.error('Account update failed:', error)
      showMessage(error.message || t('account.updateError'), 'error')
    }
  }
}

const hasAllPredictions = () => {
  return getUnlockedMatches().every(
    match => tempPredictions[match.id] || userPredictions[match.id]
  )
}

const getTempPredictionCount = () => {
  return getUnlockedMatches().filter(match => tempPredictions[match.id]).length
}

const isValidPrediction = value => ['team1', 'team2', 'draw'].includes(value)

const ensureMatchStats = matchId => {
  if (!predictionStatsByMatch[matchId]) {
    predictionStatsByMatch[matchId] = {
      team1: 0,
      draw: 0,
      team2: 0,
      total: 0
    }
  }

  return predictionStatsByMatch[matchId]
}

const applyPredictionStatsUpdate = (
  matchId,
  previousPrediction,
  nextPrediction
) => {
  const stats = ensureMatchStats(matchId)

  if (isValidPrediction(previousPrediction)) {
    stats[previousPrediction] = Math.max(0, stats[previousPrediction] - 1)
    stats.total = Math.max(0, stats.total - 1)
  }

  if (isValidPrediction(nextPrediction)) {
    stats[nextPrediction] += 1
    stats.total += 1
  }
}

const getMatchPercentages = matchId => {
  const stats = predictionStatsByMatch[matchId] || {
    team1: 0,
    draw: 0,
    team2: 0,
    total: 0
  }

  const total = Number(stats.total) || 0
  if (total <= 0) {
    return {
      team1: 0,
      draw: 0,
      team2: 0,
      total: 0
    }
  }

  const toPercent = count => Math.round((Number(count || 0) / total) * 100)

  return {
    team1: toPercent(stats.team1),
    draw: toPercent(stats.draw),
    team2: toPercent(stats.team2),
    total
  }
}

const renderPredictionForm = match => {
  const currentPrediction =
    tempPredictions[match.id] || userPredictions[match.id]
  const percentages = getMatchPercentages(match.id)
  const locked = isMatchLocked(match.id)
  const adminLocked = isMatchBetLockedByAdmin()
  const winner = allResults[match.id]?.winner
  const winnerLabel =
    winner === 'team1'
      ? translateTeamName(match.team1)
      : winner === 'team2'
      ? translateTeamName(match.team2)
      : winner === 'draw'
      ? t('common.draw')
      : ''

  return `
    <div class="match-card">
      <div class="match-header">
        <div class="match-time">${match.date} ${match.time}</div>
        ${match.round ? `<div class="match-round">${match.round}</div>` : ''}
      </div>
      <div class="match-content">
        <div class="teams">
          <span class="team-name">${translateTeamName(match.team1)}</span>
          <span class="vs">VS</span>
          <span class="team-name">${translateTeamName(match.team2)}</span>
        </div>
        <div class="prediction-buttons">
          <button class="prediction-btn ${
            currentPrediction === 'team1' ? 'active' : ''
          }" data-match-id="${match.id}" data-prediction="team1" ${
    locked || adminLocked ? 'disabled' : ''
  }>
            ${translateTeamName(match.team1)} ${t('common.wins')}
          </button>
          <button class="prediction-btn draw ${
            currentPrediction === 'draw' ? 'active' : ''
          }" data-match-id="${match.id}" data-prediction="draw" ${
    locked || adminLocked ? 'disabled' : ''
  }>
            ${t('common.draw')}
          </button>
          <button class="prediction-btn ${
            currentPrediction === 'team2' ? 'active' : ''
          }" data-match-id="${match.id}" data-prediction="team2" ${
    locked || adminLocked ? 'disabled' : ''
  }>
            ${translateTeamName(match.team2)} ${t('common.wins')}
          </button>
        </div>
        <div class="pick-percentages">
          <span class="pick-percentage-label">${t(
            'bets.pickDistribution'
          )}</span>
          <div class="pick-percentages-grid">
            <span class="pick-percentage-item">${translateTeamName(
              match.team1
            )}: ${percentages.team1}%</span>
            <span class="pick-percentage-item">${t('common.draw')}: ${
    percentages.draw
  }%</span>
            <span class="pick-percentage-item">${translateTeamName(
              match.team2
            )}: ${percentages.team2}%</span>
          </div>
        </div>
        ${
          locked
            ? `<div class="locked-note">${t('bets.lockedResult', {
                winner: winnerLabel
              })}</div>`
            : adminLocked
            ? `<div class="locked-note">${t('bets.lockedByAdmin')}</div>`
            : ''
        }
      </div>
    </div>
  `
}

const getGroupedMatches = matches => {
  const grouped = {}

  matches.forEach(match => {
    const roundName = String(match.round || t('common.notSet'))
    if (!grouped[roundName]) {
      grouped[roundName] = []
    }
    grouped[roundName].push(match)
  })

  return Object.entries(grouped).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )
}

const renderRoundSection = (roundName, roundMatches) => {
  const isCollapsed = Boolean(roundCollapsed[roundName])

  const pickedCount = roundMatches.filter(
    match => tempPredictions[match.id] || userPredictions[match.id]
  ).length
  const total = roundMatches.length
  const allPicked = pickedCount === total

  return `
    <section class="round-section ${
      isCollapsed ? 'collapsed' : ''
    }" data-round-section="${roundName}">
      <div class="round-header">
        <span class="round-title">${roundName}</span>
        <span class="round-meta">${t('common.matchesCount', {
          count: roundMatches.length
        })}</span>
        <span class="round-progress ${
          allPicked ? 'complete' : ''
        }">${pickedCount}/${total}</span>
        <button
          class="round-toggle-btn"
          type="button"
          data-round="${roundName}"
          aria-expanded="${isCollapsed ? 'false' : 'true'}"
        >
          <span class="round-chevron ${isCollapsed ? 'collapsed' : ''}">▾</span>
        </button>
      </div>
      <div class="round-matches-grid ${isCollapsed ? 'collapsed' : ''}">
        ${roundMatches.map(renderPredictionForm).join('')}
        <div class="round-footer">
          <button
            class="round-toggle-btn round-collapse-btn"
            type="button"
            data-round="${roundName}"
            aria-label="Collapse"
          >
            <span class="round-chevron round-chevron-up">▾</span>
          </button>
        </div>
      </div>
    </section>
  `
}

const toggleRoundSection = (section, roundName) => {
  if (!section || !roundName) return

  const grid = section.querySelector('.round-matches-grid')
  const nextCollapsed = !Boolean(roundCollapsed[roundName])
  roundCollapsed[roundName] = nextCollapsed

  section.classList.toggle('collapsed', nextCollapsed)
  if (grid) grid.classList.toggle('collapsed', nextCollapsed)

  section.querySelectorAll('.round-toggle-btn').forEach(btn => {
    btn.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true')
    const chevron = btn.querySelector('.round-chevron')
    if (chevron) chevron.classList.toggle('collapsed', nextCollapsed)
  })
}

const attachRoundToggleHandlers = () => {
  document.querySelectorAll('.round-toggle-btn').forEach(btn => {
    btn.addEventListener('click', event => {
      event.stopPropagation()
      const roundName = btn.dataset.round
      const section = btn.closest('.round-section')
      toggleRoundSection(section, roundName)
    })
  })

  document.querySelectorAll('.round-header').forEach(header => {
    header.addEventListener('click', event => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest('.prediction-btn') ||
          event.target.closest('.round-toggle-btn'))
      )
        return
      const section = header.closest('.round-section')
      const roundName = header.querySelector('.round-toggle-btn')?.dataset.round
      toggleRoundSection(section, roundName)
    })
  })
}

const renderMatches = matches => {
  matchesContainer.innerHTML = ''

  if (matches.length === 0) {
    matchesContainer.innerHTML = `<p style="text-align: center; padding: 20px;">${t(
      'bets.noMatchesFound'
    )}</p>`
    return
  }

  const groupedMatches = getGroupedMatches(matches)
  matchesContainer.innerHTML = groupedMatches
    .map(([roundName, roundMatches]) =>
      renderRoundSection(roundName, roundMatches)
    )
    .join('')

  attachRoundToggleHandlers()

  document.querySelectorAll('.prediction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.dataset.matchId
      const prediction = btn.dataset.prediction
      if (isBetLockedForMatch(matchId)) return

      // Update only temp predictions
      tempPredictions[matchId] = prediction

      // Re-render to update active states
      renderMatches(allMatches)
      updateSubmitButton()
    })
  })

  updateSubmitButton()
}

const updateSubmitButton = () => {
  const hasAll = hasAllPredictions()
  const tempCount = getTempPredictionCount()
  const requiredCount = getRequiredPredictionCount()

  const submitBtn = document.getElementById('placeBetBtn')
  if (submitBtn) {
    submitBtn.disabled = !hasAll || isSubmitting || requiredCount === 0
    submitBtn.textContent = isSubmitting
      ? t('bets.saving')
      : t('bets.placeBet', { done: tempCount, total: requiredCount })
  }
}

const renderUserPredictions = () => {
  const allPredictionsToShow = { ...userPredictions, ...tempPredictions }
  const predictions = Object.entries(allPredictionsToShow).filter(
    ([, pred]) => pred
  )

  let html = `
    <div class="panel-header-row">
      <h2 class="panel-title">${t('bets.myPredictions')}</h2>
      <button
        id="betsPanelToggleBtn"
        type="button"
        class="panel-collapse-btn"
        aria-expanded="${String(!predictionsPanelCollapsed)}"
      ></button>
    </div>
    <div class="bets-panel-content">
  `

  if (predictions.length === 0) {
    html += `<p>${t('bets.noPredictionsYet')}</p>`
  } else {
    const predictionsHtml = predictions
      .map(([matchId, prediction]) => {
        const match = allMatches.find(m => m.id === matchId)
        if (!match) return ''

        const label =
          prediction === 'team1'
            ? translateTeamName(match.team1)
            : prediction === 'team2'
            ? translateTeamName(match.team2)
            : t('common.draw')
        const isSaved = userPredictions[matchId] === prediction
        const isTemp = tempPredictions[matchId] === prediction

        return `
          <div class="prediction-item ${isTemp ? 'unsaved' : ''} ${
          isSaved ? 'saved' : ''
        }">
            <div class="prediction-label">${label}</div>
            <div class="prediction-match">${translateTeamName(
              match.team1
            )} vs ${translateTeamName(match.team2)}</div>
            ${
              isTemp
                ? `<div class="unsaved-badge">${t('bets.unsaved')}</div>`
                : ''
            }
          </div>
        `
      })
      .join('')

    html += predictionsHtml
  }

  html += '</div>'

  betsPanel.innerHTML = html
  attachPredictionsPanelToggle()
  applyPredictionsPanelState()

  // Add or update submit button section
  let submitSection = document.getElementById('submitSection')
  if (!submitSection) {
    submitSection = document.createElement('div')
    submitSection.id = 'submitSection'
    submitSection.className = 'submit-section'
    betsPanel.parentElement.insertBefore(submitSection, betsPanel)
  }

  const hasAll = hasAllPredictions()
  const tempCount = getTempPredictionCount()
  const requiredCount = getRequiredPredictionCount()

  submitSection.innerHTML = `
    <button id="placeBetBtn" class="place-bet-btn" ${
      !hasAll || isSubmitting || requiredCount === 0 ? 'disabled' : ''
    }>
      ${
        isSubmitting
          ? t('bets.saving')
          : t('bets.placeBet', { done: tempCount, total: requiredCount })
      }
    </button>
    <div id="submitMessage" class="submit-message" style="display: none;"></div>
  `

  const submitBtn = document.getElementById('placeBetBtn')
  submitBtn.addEventListener('click', submitAllPredictions)
}

const submitAllPredictions = async () => {
  if (!hasAllPredictions() || isSubmitting) return

  if (isMatchBetLockedByAdmin()) {
    const messageDiv = document.getElementById('submitMessage')
    if (messageDiv) {
      messageDiv.textContent = `✗ ${t('bets.lockedByAdmin')}`
      messageDiv.className = 'submit-message error'
      messageDiv.style.display = 'block'
    }
    return
  }

  isSubmitting = true
  const submitBtn = document.getElementById('placeBetBtn')
  const messageDiv = document.getElementById('submitMessage')

  try {
    // Combine temp predictions with saved ones for submission
    const allPredictionsToSubmit = Object.fromEntries(
      Object.entries(tempPredictions).filter(
        ([matchId]) => !isBetLockedForMatch(matchId)
      )
    )

    if (Object.keys(allPredictionsToSubmit).length === 0) {
      messageDiv.textContent = t('bets.noUnlockedToSave')
      messageDiv.className = 'submit-message error'
      messageDiv.style.display = 'block'
      return
    }

    await makeBatchPredictions(currentUser.uid, allPredictionsToSubmit)

    Object.entries(allPredictionsToSubmit).forEach(
      ([matchId, nextPrediction]) => {
        const previousPrediction = userPredictions[matchId]
        applyPredictionStatsUpdate(matchId, previousPrediction, nextPrediction)
      }
    )

    // Move temp predictions to saved
    Object.assign(userPredictions, allPredictionsToSubmit)
    tempPredictions = {}

    messageDiv.textContent = `✓ ${t('bets.saveSuccess')}`
    messageDiv.className = 'submit-message success'
    messageDiv.style.display = 'block'

    renderMatches(allMatches)
    renderUserPredictions()

    setTimeout(() => {
      messageDiv.style.display = 'none'
    }, 3000)
  } catch (error) {
    console.error('Failed to save predictions:', error)
    messageDiv.textContent = `✗ ${t('bets.saveFailed')}`
    messageDiv.className = 'submit-message error'
    messageDiv.style.display = 'block'
  } finally {
    isSubmitting = false
    updateSubmitButton()
  }
}

const run = async () => {
  try {
    const [matches, predictions, results, locks, statsByMatch] =
      await Promise.all([
        getAllMatchesFlat(),
        getUserPredictions(currentUser.uid),
        getAllMatchResults(),
        getBetLocks(),
        getPredictionStatsByMatch()
      ])

    allMatches = matches
    allResults = results || {}
    predictionStatsByMatch = statsByMatch || {}
    betLocks = locks || { matchesLockedAt: '', winnerLockedAt: '' }
    userPredictions = {}
    predictions.forEach(pred => {
      userPredictions[pred.matchId] = pred.prediction
    })

    // Initialise collapsed state — new rounds start collapsed, removed ones are cleaned up
    const availableRounds = new Set(
      allMatches.map(match => String(match.round || t('common.notSet')))
    )
    Object.keys(roundCollapsed).forEach(roundName => {
      if (!availableRounds.has(roundName)) delete roundCollapsed[roundName]
    })
    availableRounds.forEach(roundName => {
      if (!(roundName in roundCollapsed)) roundCollapsed[roundName] = true
    })

    renderMatches(allMatches)
    renderUserPredictions()
  } catch (error) {
    matchesContainer.innerHTML = `<p>${t('bets.couldNotLoad')}</p>`
    console.error(error)
  }
}

compactToggle?.addEventListener('click', () => {
  compactMode = !compactMode
  window.localStorage.setItem(COMPACT_MODE_KEY, compactMode ? 'on' : 'off')
  applyCompactMode()
})

logoutBtn.addEventListener('click', async () => {
  try {
    await logOut()
    window.location.href = 'login.html'
  } catch (error) {
    console.error('Logout failed:', error)
  }
})

onAuthChange(async user => {
  if (!user) {
    window.location.href = 'login.html'
    return
  }

  currentUser = user
  await updateAdminTabVisibility(user)
  const profile = await getUserProfile(user.uid)
  userEmail.textContent = profile.nickname || user.email || t('common.user')
  logoutBtn.textContent = t('common.logout')
  attachAccountSettingsModal(profile)
  run()
})

onLanguageChange(() => {
  logoutBtn.textContent = t('common.logout')
  updateCompactToggleLabel()
  userEmail.title = t('nickname.clickToChange')
  renderMatches(allMatches)
  renderUserPredictions()
})
