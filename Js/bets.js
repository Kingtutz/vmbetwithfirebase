import {
  getAllMatchesFlat,
  getAllMatchResults,
  getUserProfile,
  getUserPredictions,
  isAdminUser,
  makeBatchPredictions,
  onAuthChange,
  logOut,
  setUserNickname
} from './firebase.js'

const matchesContainer = document.getElementById('matches')
const roundFilter = document.getElementById('roundFilter')
const betsPanel = document.getElementById('betsPanel')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')

let allMatches = []
let userPredictions = {} // Saved predictions from Firebase
let tempPredictions = {} // Local predictions awaiting submission
let allResults = {}
let currentUser = null
let isSubmitting = false

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

const updateAdminTabVisibility = async user => {
  if (!adminNavLink) return

  const admin = await isAdminUser(user)
  adminNavLink.style.display = admin ? '' : 'none'
}

const isMatchLocked = matchId => Boolean(allResults[matchId]?.winner)

const getUnlockedMatches = () =>
  allMatches.filter(match => !isMatchLocked(match.id))

const getRequiredPredictionCount = () => getUnlockedMatches().length

const attachNicknameEditor = currentNickname => {
  userEmail.style.cursor = 'pointer'
  userEmail.title = 'Click to change nickname'

  userEmail.onclick = async () => {
    if (!currentUser) return

    const nextNickname = window.prompt(
      'Enter your nickname',
      currentNickname || userEmail.textContent || ''
    )

    if (nextNickname == null) return

    const cleanNickname = nextNickname.trim()
    if (!cleanNickname) {
      window.alert('Nickname cannot be empty.')
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
      window.alert(error.message || 'Could not update nickname.')
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
  const winner = allResults[match.id]?.winner
  const winnerLabel =
    winner === 'team1'
      ? match.team1
      : winner === 'team2'
      ? match.team2
      : winner === 'draw'
      ? 'Draw'
      : ''

  return `
    <div class="match-card">
      <div class="match-header">
        <div class="match-time">${match.date} ${match.time}</div>
        ${match.round ? `<div class="match-round">${match.round}</div>` : ''}
      </div>
      <div class="match-content">
        <div class="teams">
          <span class="team-name">${match.team1}</span>
          <span class="vs">VS</span>
          <span class="team-name">${match.team2}</span>
        </div>
        <div class="prediction-buttons">
          <button class="prediction-btn ${
            currentPrediction === 'team1' ? 'active' : ''
          }" data-match-id="${match.id}" data-prediction="team1" ${
    locked ? 'disabled' : ''
  }>
            ${match.team1} Wins
          </button>
          <button class="prediction-btn draw ${
            currentPrediction === 'draw' ? 'active' : ''
          }" data-match-id="${match.id}" data-prediction="draw" ${
    locked ? 'disabled' : ''
  }>
            Draw
          </button>
          <button class="prediction-btn ${
            currentPrediction === 'team2' ? 'active' : ''
          }" data-match-id="${match.id}" data-prediction="team2" ${
    locked ? 'disabled' : ''
  }>
            ${match.team2} Wins
          </button>
        </div>
        ${
          locked
            ? `<div class="locked-note">Locked - result set: ${winnerLabel}</div>`
            : ''
        }
      </div>
    </div>
  `
}

const renderMatches = matches => {
  matchesContainer.innerHTML = ''

  if (matches.length === 0) {
    matchesContainer.innerHTML =
      '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">No matches found.</p>'
    return
  }

  const matchesHtml = matches.map(match => renderPredictionForm(match)).join('')
  matchesContainer.innerHTML = matchesHtml

  document.querySelectorAll('.prediction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.dataset.matchId
      const prediction = btn.dataset.prediction
      if (isMatchLocked(matchId)) return

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
      ? 'Saving...'
      : `Place Bet (${tempCount}/${requiredCount})`
  }
}

const renderUserPredictions = () => {
  const allPredictionsToShow = { ...userPredictions, ...tempPredictions }
  const predictions = Object.entries(allPredictionsToShow).filter(
    ([, pred]) => pred
  )

  let html = `<h2 class="panel-title">My Predictions</h2>`

  if (predictions.length === 0) {
    html += `<p>You haven't made any predictions yet.</p>`
  } else {
    const predictionsHtml = predictions
      .map(([matchId, prediction]) => {
        const match = allMatches.find(m => m.id === matchId)
        if (!match) return ''

        const label =
          prediction === 'team1'
            ? match.team1
            : prediction === 'team2'
            ? match.team2
            : 'Draw'
        const isSaved = userPredictions[matchId] === prediction
        const isTemp = tempPredictions[matchId] === prediction

        return `
          <div class="prediction-item ${isTemp ? 'unsaved' : ''} ${
          isSaved ? 'saved' : ''
        }">
            <div class="prediction-label">${label}</div>
            <div class="prediction-match">${match.team1} vs ${match.team2}</div>
            ${isTemp ? '<div class="unsaved-badge">Unsaved</div>' : ''}
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
        isSubmitting ? 'Saving...' : `Place Bet (${tempCount}/${requiredCount})`
      }
    </button>
    <div id="submitMessage" class="submit-message" style="display: none;"></div>
  `

  const submitBtn = document.getElementById('placeBetBtn')
  submitBtn.addEventListener('click', submitAllPredictions)
}

const submitAllPredictions = async () => {
  if (!hasAllPredictions() || isSubmitting) return

  isSubmitting = true
  const submitBtn = document.getElementById('placeBetBtn')
  const messageDiv = document.getElementById('submitMessage')

  try {
    // Combine temp predictions with saved ones for submission
    const allPredictionsToSubmit = Object.fromEntries(
      Object.entries(tempPredictions).filter(
        ([matchId]) => !isMatchLocked(matchId)
      )
    )

    if (Object.keys(allPredictionsToSubmit).length === 0) {
      messageDiv.textContent = 'No unlocked predictions to save.'
      messageDiv.className = 'submit-message error'
      messageDiv.style.display = 'block'
      return
    }

    await makeBatchPredictions(currentUser.uid, allPredictionsToSubmit)

    // Move temp predictions to saved
    Object.assign(userPredictions, allPredictionsToSubmit)
    tempPredictions = {}

    messageDiv.textContent = '✓ All predictions saved successfully!'
    messageDiv.className = 'submit-message success'
    messageDiv.style.display = 'block'

    renderMatches(allMatches)
    renderUserPredictions()

    setTimeout(() => {
      messageDiv.style.display = 'none'
    }, 3000)
  } catch (error) {
    console.error('Failed to save predictions:', error)
    messageDiv.textContent = '✗ Failed to save predictions. Please try again.'
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
    const [matches, predictions, results] = await Promise.all([
      getAllMatchesFlat(),
      getUserPredictions(currentUser.uid),
      getAllMatchResults()
    ])

    allMatches = matches
    allResults = results || {}
    userPredictions = {}
    predictions.forEach(pred => {
      userPredictions[pred.matchId] = pred.prediction
    })
    renderMatches(allMatches)
    renderUserPredictions()
  } catch (error) {
    matchesContainer.innerHTML = '<p>Could not load matches from Firebase.</p>'
    console.error(error)
  }
}

roundFilter.addEventListener('input', applyFilter)

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
  userEmail.textContent = profile.nickname || user.email || 'User'
  attachNicknameEditor(profile.nickname || '')
  run()
})
