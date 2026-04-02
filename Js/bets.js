import {
  getAllMatchesFlat,
  getAllMatchResults,
  getBetLocks,
  getUserProfile,
  getUserPredictions,
  isAdminUser,
  makeBatchPredictions,
  onAuthChange,
  logOut,
  setUserNickname
} from './firebase.js'
import { initI18n, onLanguageChange, t, translateTeamName } from './i18n.js'

const matchesContainer = document.getElementById('matches')
const roundFilter = document.getElementById('roundFilter')
const compactToggle = document.getElementById('compactToggle')
const betsPanel = document.getElementById('betsPanel')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')

let allMatches = []
let userPredictions = {} // Saved predictions from Firebase
let tempPredictions = {} // Local predictions awaiting submission
let allResults = {}
let betLocks = { matchesLockedAt: '', winnerLockedAt: '' }
let currentUser = null
let isSubmitting = false
const COMPACT_MODE_KEY = 'betsCompactMode'
let compactMode = window.localStorage.getItem(COMPACT_MODE_KEY) !== 'off'

initI18n()

const updateCompactToggleLabel = () => {
  if (!compactToggle) return
  compactToggle.textContent = compactMode
    ? t('bets.compactOn')
    : t('bets.compactOff')
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
  if (!adminNavLink) return

  const admin = await isAdminUser(user)
  adminNavLink.style.display = admin ? '' : 'none'
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

const attachNicknameEditor = currentNickname => {
  userEmail.style.cursor = 'pointer'
  userEmail.title = t('nickname.clickToChange')

  userEmail.onclick = async () => {
    if (!currentUser) return

    const nextNickname = window.prompt(
      t('nickname.prompt'),
      currentNickname || userEmail.textContent || ''
    )

    if (nextNickname == null) return

    const cleanNickname = nextNickname.trim()
    if (!cleanNickname) {
      window.alert(t('nickname.empty'))
      return
    }

    try {
      const savedNickname = await setUserNickname(
        currentUser.uid,
        cleanNickname
      )
      userEmail.textContent = savedNickname
    } catch (error) {
      console.error('Nickname update failed:', error)
      window.alert(error.message || t('nickname.updateFailed'))
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

const renderPredictionForm = match => {
  const currentPrediction =
    tempPredictions[match.id] || userPredictions[match.id]
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

const renderMatches = matches => {
  matchesContainer.innerHTML = ''

  if (matches.length === 0) {
    matchesContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px;">${t(
      'bets.noMatchesFound'
    )}</p>`
    return
  }

  const matchesHtml = matches.map(match => renderPredictionForm(match)).join('')
  matchesContainer.innerHTML = matchesHtml

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

  let html = `<h2 class="panel-title">${t('bets.myPredictions')}</h2>`

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

  betsPanel.innerHTML = html

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

const applyFilter = () => {
  const query = roundFilter.value.trim().toLowerCase()
  if (!query) {
    renderMatches(allMatches)
    return
  }

  const filtered = allMatches.filter(match =>
    (match.round || '').toLowerCase().includes(query)
  )
  renderMatches(filtered)
}

const run = async () => {
  try {
    const [matches, predictions, results, locks] = await Promise.all([
      getAllMatchesFlat(),
      getUserPredictions(currentUser.uid),
      getAllMatchResults(),
      getBetLocks()
    ])

    allMatches = matches
    allResults = results || {}
    betLocks = locks || { matchesLockedAt: '', winnerLockedAt: '' }
    userPredictions = {}
    predictions.forEach(pred => {
      userPredictions[pred.matchId] = pred.prediction
    })
    renderMatches(allMatches)
    renderUserPredictions()
  } catch (error) {
    matchesContainer.innerHTML = `<p>${t('bets.couldNotLoad')}</p>`
    console.error(error)
  }
}

roundFilter.addEventListener('input', applyFilter)

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
  attachNicknameEditor(profile.nickname || '')
  run()
})

onLanguageChange(() => {
  logoutBtn.textContent = t('common.logout')
  updateCompactToggleLabel()
  attachNicknameEditor(userEmail.textContent)
  applyFilter()
  renderUserPredictions()
})
