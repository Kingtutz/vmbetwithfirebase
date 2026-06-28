import { auth, db, getBetLocks, isAdminUser } from './firebase.js'
import {
  get,
  ref,
  remove,
  set
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js'
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'

// Knockout Bracket JavaScript - Demo Mode Compatible

// Tournament knockout structure with actual 2026 World Cup matches
const knockoutData = {
  round32: [
    {
      team1: 'South Africa',
      team2: 'Canada',
      date: 'June 28',
      location: 'Inglewood'
    },
    {
      team1: 'Germany',
      team2: 'Paraguay',
      date: 'June 29',
      location: 'Houston'
    },
    {
      team1: 'Netherlands',
      team2: 'Morocco',
      date: 'June 29',
      location: 'Guadalupe'
    },
    { team1: 'Brazil', team2: 'Japan', date: 'June 29', location: 'Houston' },
    {
      team1: 'France',
      team2: 'Sweden',
      date: 'June 30',
      location: 'Arlington'
    },
    {
      team1: 'Ivory Coast',
      team2: 'Norway',
      date: 'June 30',
      location: 'Mexico City'
    },
    {
      team1: 'Mexico',
      team2: 'Ecuador',
      date: 'June 30',
      location: 'East Rutherford'
    },
    {
      team1: 'England',
      team2: 'DR Congo',
      date: 'July 1',
      location: 'Atlanta'
    },
    { team1: 'Belgium', team2: 'Senegal', date: 'July 1', location: 'Seattle' },
    {
      team1: 'United States',
      team2: 'Bosnia and Herzegovina',
      date: 'July 1',
      location: 'Seattle'
    },
    {
      team1: 'Spain',
      team2: 'Austria',
      date: 'July 2',
      location: 'Santa Clara'
    },
    {
      team1: 'Portugal',
      team2: 'Croatia',
      date: 'July 2',
      location: 'Inglewood'
    },
    {
      team1: 'Switzerland',
      team2: 'Algeria',
      date: 'July 2',
      location: 'Vancouver'
    },
    {
      team1: 'Australia',
      team2: 'Egypt',
      date: 'July 3',
      location: 'Vancouver'
    },
    {
      team1: 'Argentina',
      team2: 'Cape Verde',
      date: 'July 3',
      location: 'Arlington'
    },
    {
      team1: 'Colombia',
      team2: 'Ghana',
      date: 'July 3',
      location: 'Miami Gardens'
    }
  ],
  round16: [
    { team1: 'W73', team2: 'W75', date: 'July 4', location: 'Houston' },
    { team1: 'W74', team2: 'W77', date: 'July 4', location: 'Philadelphia' },
    { team1: 'W76', team2: 'W78', date: 'July 5', location: 'East Rutherford' },
    { team1: 'W79', team2: 'W80', date: 'July 5', location: 'Mexico City' },
    { team1: 'W83', team2: 'W84', date: 'July 6', location: 'Mexico City' },
    { team1: 'W81', team2: 'W82', date: 'July 6', location: 'Seattle' },
    { team1: 'W86', team2: 'W88', date: 'July 7', location: 'Atlanta' },
    { team1: 'W85', team2: 'W87', date: 'July 7', location: 'Vancouver' }
  ],
  quarterfinals: [
    { team1: 'W89', team2: 'W90', date: 'July 9', location: 'Foxborough' },
    { team1: 'W93', team2: 'W94', date: 'July 10', location: 'Inglewood' },
    { team1: 'W91', team2: 'W92', date: 'July 11', location: 'Miami Gardens' },
    { team1: 'W95', team2: 'W96', date: 'July 11', location: 'Kansas City' }
  ],
  semifinals: [
    { team1: 'W97', team2: 'W98', date: 'July 14', location: 'Arlington' },
    { team1: 'W99', team2: 'W100', date: 'July 15', location: 'Atlanta' }
  ],
  final: [
    {
      team1: 'W101',
      team2: 'W102',
      date: 'July 19',
      location: 'East Rutherford'
    }
  ]
}

let currentUser = null
let userPredictions = {}
let betLocks = { matchesLockedAt: '', winnerLockedAt: '', knockoutLockedAt: '' }
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

async function updateAdminTabVisibility (user) {
  if (!adminNavLink) return
  const admin = await isAdminUser(user)
  adminNavLink.style.display = admin ? '' : 'none'
}

function isKnockoutLockedByAdmin () {
  const lockAt = String(betLocks.knockoutLockedAt || '')
  if (!lockAt) return false

  const lockTime = new Date(lockAt).getTime()
  if (Number.isNaN(lockTime)) return false
  return Date.now() >= lockTime
}

function renderLockState () {
  const locked = isKnockoutLockedByAdmin()
  const saveBtn = document.getElementById('saveBtn')
  const clearBtn = document.getElementById('clearBtn')
  const lockStatus = document.getElementById('lockStatus')

  if (saveBtn) saveBtn.disabled = locked
  if (clearBtn) clearBtn.disabled = locked

  if (lockStatus) {
    lockStatus.style.display = locked ? 'block' : 'none'
    lockStatus.textContent = locked ? 'Knockout bets are locked by admin.' : ''
  }
}

async function loadBetLocks () {
  try {
    const locks = await getBetLocks()
    betLocks = {
      matchesLockedAt: String(locks?.matchesLockedAt || ''),
      winnerLockedAt: String(locks?.winnerLockedAt || ''),
      knockoutLockedAt: String(locks?.knockoutLockedAt || '')
    }
  } catch (error) {
    console.error('Error loading lock settings:', error)
  } finally {
    renderLockState()
  }
}

// Initialize bracket on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('Page loaded - initializing bracket')

  const saveBtn = document.getElementById('saveBtn')
  if (saveBtn) {
    saveBtn.addEventListener('click', savePredictions)
  }

  const clearBtn = document.getElementById('clearBtn')
  if (clearBtn) {
    clearBtn.addEventListener('click', clearPredictions)
  }

  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth)
      window.location.href = 'login.html'
    })
  }

  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = 'login.html'
      return
    }

    currentUser = user
    await updateAdminTabVisibility(user)
    const emailEl = document.getElementById('userEmail')
    if (emailEl) {
      emailEl.textContent = user.email || 'Knockout predictions'
    }

    await loadBetLocks()
    await loadUserPredictions()
    initializeBracket()
  })
})

// Initialize the bracket display
function initializeBracket () {
  console.log('Initializing bracket...')

  // LEFT SIDE (flows left to right to center)
  renderRound(
    'round32-left',
    knockoutData.round32.slice(0, 8),
    'round32-left',
    'Round of 32'
  )
  renderRound(
    'round16-left',
    knockoutData.round16.slice(0, 4),
    'round16-left',
    'Round of 16'
  )
  renderRound(
    'quarterfinals-left',
    knockoutData.quarterfinals.slice(0, 2),
    'quarterfinals-left',
    'Quarterfinals'
  )
  renderRound(
    'semifinals-left',
    knockoutData.semifinals.slice(0, 1),
    'semifinals-left',
    'Semifinals'
  )

  // CENTER (Final)
  renderRound('final', knockoutData.final, 'final', 'Final')

  // RIGHT SIDE (flows right to left to center)
  renderRound(
    'semifinals-right',
    knockoutData.semifinals.slice(1, 2),
    'semifinals-right',
    'Semifinals'
  )
  renderRound(
    'quarterfinals-right',
    knockoutData.quarterfinals.slice(2, 4),
    'quarterfinals-right',
    'Quarterfinals'
  )
  renderRound(
    'round16-right',
    knockoutData.round16.slice(4, 8),
    'round16-right',
    'Round of 16'
  )
  renderRound(
    'round32-right',
    knockoutData.round32.slice(8, 16),
    'round32-right',
    'Round of 32'
  )

  // Restore advanced teams from saved predictions
  restoreAdvancedTeams()
}

// Render a round of matches
function renderRound (containerId, matches, roundPrefix, roundName) {
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`Container not found: ${containerId}`)
    return
  }

  container.innerHTML = `<h3>${roundName}</h3>`

  // Calculate spacing multiplier based on round size (adjusted for split rounds)
  let spacingMultiplier = 1
  switch (matches.length) {
    case 16:
      spacingMultiplier = 1
      break // Full Round of 32
    case 8:
      spacingMultiplier = 1
      break // Round of 32 (left or right half)
    case 4:
      spacingMultiplier = 2
      break // Round of 16 (left or right half)
    case 2:
      spacingMultiplier = 4
      break // Quarterfinals (left or right half)
    case 1:
      spacingMultiplier = 8
      break // Semifinals (left or right) / Final
  }

  matches.forEach((match, index) => {
    try {
      const matchId = `${roundPrefix}_${index}`
      const matchDiv = createMatchElement(match, matchId)

      // Add margin bottom for bracket alignment
      const gap = 80 * spacingMultiplier // Base gap in pixels
      if (index < matches.length - 1) {
        matchDiv.style.marginBottom = gap - 90 + 'px'
      }

      container.appendChild(matchDiv)
    } catch (error) {
      console.error(`Error creating match ${roundPrefix}_${index}:`, error)
    }
  })
}

// Create a single match element for bracket display
function createMatchElement (match, matchId) {
  const matchDiv = document.createElement('div')
  matchDiv.className = 'match-box'
  matchDiv.id = matchId
  matchDiv.setAttribute('data-match-id', matchId)

  const prediction = userPredictions[matchId] || {}
  const winner = prediction.winner || null
  const score1 = prediction.score1 || 0
  const score2 = prediction.score2 || 0

  const isTeam1Selected = winner === 1
  const isTeam2Selected = winner === 2

  // Team 1
  const team1Div = document.createElement('div')
  team1Div.className = `team-box ${isTeam1Selected ? 'selected' : ''}`
  team1Div.innerHTML = `
    <span class="team-name winner-target" tabindex="0" role="button" data-match="${matchId}" data-team="1">${
    match.team1
  }</span>
    <button class="team-selector ${
      isTeam1Selected ? 'selected' : ''
    }" data-match="${matchId}" data-team="1">
      <span class="score">${score1}</span>
    </button>
  `

  // Team 2
  const team2Div = document.createElement('div')
  team2Div.className = `team-box ${isTeam2Selected ? 'selected' : ''}`
  team2Div.innerHTML = `
    <span class="team-name winner-target" tabindex="0" role="button" data-match="${matchId}" data-team="2">${
    match.team2
  }</span>
    <button class="team-selector ${
      isTeam2Selected ? 'selected' : ''
    }" data-match="${matchId}" data-team="2">
      <span class="score">${score2}</span>
    </button>
  `

  matchDiv.appendChild(team1Div)
  matchDiv.appendChild(team2Div)

  // Winner is selected by clicking team name.
  const team1Target = team1Div.querySelector('.winner-target')
  const team2Target = team2Div.querySelector('.winner-target')

  team1Target.addEventListener('click', () => {
    selectWinner(matchId, 1, matchDiv)
  })
  team2Target.addEventListener('click', () => {
    selectWinner(matchId, 2, matchDiv)
  })

  team1Target.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectWinner(matchId, 1, matchDiv)
    }
  })
  team2Target.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectWinner(matchId, 2, matchDiv)
    }
  })

  // Click score bubble to edit score.
  team1Div
    .querySelector('.team-selector')
    .addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      if (isKnockoutLockedByAdmin()) {
        showToast('Knockout bets are locked by admin', 'error')
        return
      }
      const score = prompt(`Enter score for ${match.team1}:`, score1)
      if (score !== null && score !== '') {
        const pred = userPredictions[matchId] || {}
        pred.score1 = Math.max(0, parseInt(score) || 0)
        userPredictions[matchId] = pred
        team1Div.querySelector('.score').textContent = pred.score1
        updateMatchStatus(matchDiv)
      }
    })

  team2Div
    .querySelector('.team-selector')
    .addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      if (isKnockoutLockedByAdmin()) {
        showToast('Knockout bets are locked by admin', 'error')
        return
      }
      const score = prompt(`Enter score for ${match.team2}:`, score2)
      if (score !== null && score !== '') {
        const pred = userPredictions[matchId] || {}
        pred.score2 = Math.max(0, parseInt(score) || 0)
        userPredictions[matchId] = pred
        team2Div.querySelector('.score').textContent = pred.score2
        updateMatchStatus(matchDiv)
      }
    })

  updateMatchStatus(matchDiv)
  return matchDiv
}

// Select a winner and advance to next round
function selectWinner (matchId, winner, matchDiv) {
  if (isKnockoutLockedByAdmin()) {
    showToast('Knockout bets are locked by admin', 'error')
    return
  }

  const prediction = userPredictions[matchId] || {}
  const currentRound = matchDiv.parentElement.id

  if (prediction.winner === winner) {
    prediction.winner = null
  } else {
    prediction.winner = winner
  }

  userPredictions[matchId] = prediction

  // Update selected state on both score badges and team rows.
  const buttons = matchDiv.querySelectorAll('.team-selector')
  buttons.forEach(btn => {
    const btnTeam = parseInt(btn.getAttribute('data-team'))
    btn.classList.toggle('selected', btnTeam === prediction.winner)
  })

  const teamRows = matchDiv.querySelectorAll('.team-box')
  teamRows.forEach((row, idx) => {
    row.classList.toggle('selected', prediction.winner === idx + 1)
  })

  updateMatchStatus(matchDiv)

  // Advance winner to next round
  if (prediction.winner) {
    advanceTeam(matchId, winner, currentRound)
  } else {
    // Clear next round when selection is removed
    clearAdvancedTeam(matchId, currentRound)
  }
}

// Get the next round container and match info
function getNextRoundInfo (currentRound, matchIndex) {
  const roundMap = {
    'round32-left': {
      nextRound: 'round16-left',
      nextMatchIndex: Math.floor(matchIndex / 2),
      posInNextMatch: (matchIndex % 2) + 1
    },
    'round32-right': {
      nextRound: 'round16-right',
      nextMatchIndex: Math.floor(matchIndex / 2),
      posInNextMatch: (matchIndex % 2) + 1
    },
    'round16-left': {
      nextRound: 'quarterfinals-left',
      nextMatchIndex: Math.floor(matchIndex / 2),
      posInNextMatch: (matchIndex % 2) + 1
    },
    'round16-right': {
      nextRound: 'quarterfinals-right',
      nextMatchIndex: Math.floor(matchIndex / 2),
      posInNextMatch: (matchIndex % 2) + 1
    },
    'quarterfinals-left': {
      nextRound: 'semifinals-left',
      nextMatchIndex: Math.floor(matchIndex / 2),
      posInNextMatch: (matchIndex % 2) + 1
    },
    'quarterfinals-right': {
      nextRound: 'semifinals-right',
      nextMatchIndex: Math.floor(matchIndex / 2),
      posInNextMatch: (matchIndex % 2) + 1
    },
    'semifinals-left': {
      nextRound: 'final',
      nextMatchIndex: 0,
      posInNextMatch: 1
    },
    'semifinals-right': {
      nextRound: 'final',
      nextMatchIndex: 0,
      posInNextMatch: 2
    }
  }

  return roundMap[currentRound]
}

// Advance a team to the next round
function advanceTeam (matchId, winnerTeamNumber, currentRound) {
  const parts = matchId.split('_')
  const matchIndex = parseInt(parts[parts.length - 1])
  const nextInfo = getNextRoundInfo(currentRound, matchIndex)

  if (!nextInfo) return

  const currentMatch = findMatchInRound(currentRound, matchIndex)
  if (!currentMatch) return

  const winningTeam =
    winnerTeamNumber === 1 ? currentMatch.team1 : currentMatch.team2

  // Find the next round match
  const nextRoundContainer = document.getElementById(nextInfo.nextRound)
  const nextMatches = nextRoundContainer.querySelectorAll('.match-box')
  const nextMatch = nextMatches[nextInfo.nextMatchIndex]

  if (!nextMatch) return

  // Update the team in the next round
  const teamDivs = nextMatch.querySelectorAll('.team-box')
  const targetTeamDiv = teamDivs[nextInfo.posInNextMatch - 1]

  if (targetTeamDiv) {
    const teamNameSpan = targetTeamDiv.querySelector('.team-name')
    teamNameSpan.textContent = winningTeam
    teamNameSpan.title = winningTeam // Add tooltip
  }
}

// Clear advanced team when selection is removed
function clearAdvancedTeam (matchId, currentRound) {
  const parts = matchId.split('_')
  const matchIndex = parseInt(parts[parts.length - 1])
  const nextInfo = getNextRoundInfo(currentRound, matchIndex)

  if (!nextInfo) return

  const nextRoundContainer = document.getElementById(nextInfo.nextRound)
  const nextMatches = nextRoundContainer.querySelectorAll('.match-box')
  const nextMatch = nextMatches[nextInfo.nextMatchIndex]

  if (!nextMatch) return

  const teamDivs = nextMatch.querySelectorAll('.team-box')
  const targetTeamDiv = teamDivs[nextInfo.posInNextMatch - 1]

  if (targetTeamDiv) {
    const teamNameSpan = targetTeamDiv.querySelector('.team-name')

    // Restore the original placeholder from knockoutData
    const roundDataMap = {
      'round16-left': knockoutData.round16.slice(0, 4),
      'round16-right': knockoutData.round16.slice(4, 8),
      'quarterfinals-left': knockoutData.quarterfinals.slice(0, 2),
      'quarterfinals-right': knockoutData.quarterfinals.slice(2, 4),
      'semifinals-left': knockoutData.semifinals.slice(0, 1),
      'semifinals-right': knockoutData.semifinals.slice(1, 2),
      final: knockoutData.final
    }

    const roundData = roundDataMap[nextInfo.nextRound]
    if (roundData && roundData[nextInfo.nextMatchIndex]) {
      const match = roundData[nextInfo.nextMatchIndex]
      const originalTeam =
        nextInfo.posInNextMatch === 1 ? match.team1 : match.team2
      teamNameSpan.textContent = originalTeam
      teamNameSpan.title = originalTeam
    }
  }
}

// Find a match in a round by index
function findMatchInRound (roundId, matchIndex) {
  const roundContainer = document.getElementById(roundId)
  if (!roundContainer) return null

  const matches = roundContainer.querySelectorAll('.match-box')
  if (matches[matchIndex]) {
    const matchBox = matches[matchIndex]
    const teamBoxes = matchBox.querySelectorAll('.team-box')
    const team1 = teamBoxes[0]?.querySelector('.team-name')?.textContent || ''
    const team2 = teamBoxes[1]?.querySelector('.team-name')?.textContent || ''
    return { team1, team2 }
  }

  return null
}

// Restore advanced teams from saved predictions
function restoreAdvancedTeams () {
  // Iterate through all saved predictions and advance teams
  const roundsToProcess = [
    'round32-left',
    'round32-right',
    'round16-left',
    'round16-right',
    'quarterfinals-left',
    'quarterfinals-right',
    'semifinals-left',
    'semifinals-right'
  ]

  roundsToProcess.forEach(roundId => {
    const roundContainer = document.getElementById(roundId)
    if (!roundContainer) return

    const matches = roundContainer.querySelectorAll('.match-box')
    matches.forEach((matchBox, matchIndex) => {
      const matchId = matchBox.id
      const prediction = userPredictions[matchId]

      if (prediction && prediction.winner) {
        // Advance this team to next round
        advanceTeam(matchId, prediction.winner, roundId)
      }
    })
  })
}

// Update match visual status
function updateMatchStatus (matchDiv) {
  const matchId = matchDiv.id
  const prediction = userPredictions[matchId]

  if (
    prediction &&
    (prediction.winner || prediction.score1 || prediction.score2)
  ) {
    matchDiv.classList.add('completed')
  } else {
    matchDiv.classList.remove('completed')
  }
}

async function loadUserPredictions () {
  if (!currentUser) return

  try {
    const userRef = ref(db, `knockout_predictions/${currentUser.uid}`)
    const snapshot = await get(userRef)

    if (snapshot.exists()) {
      userPredictions = snapshot.val() || {}
      localStorage.setItem(
        'knockout_predictions',
        JSON.stringify(userPredictions)
      )
      return
    }

    const stored = localStorage.getItem('knockout_predictions')
    if (stored) {
      try {
        userPredictions = JSON.parse(stored) || {}
        await set(userRef, userPredictions)
      } catch (parseError) {
        console.error('Error parsing stored predictions:', parseError)
        userPredictions = {}
      }
    }
  } catch (error) {
    console.error('Error loading predictions:', error)
  }
}

// Save predictions to Firebase
async function savePredictions () {
  try {
    if (!currentUser) {
      showToast('Please sign in to save predictions', 'error')
      return
    }

    if (isKnockoutLockedByAdmin()) {
      showToast('Knockout bets are locked by admin', 'error')
      return
    }

    const saveBtn = document.getElementById('saveBtn')
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving...'

    const userRef = ref(db, `knockout_predictions/${currentUser.uid}`)
    await set(userRef, userPredictions)
    localStorage.setItem(
      'knockout_predictions',
      JSON.stringify(userPredictions)
    )

    saveBtn.disabled = false
    saveBtn.textContent = 'Save Predictions'
    showToast('Predictions saved successfully!', 'success')
  } catch (error) {
    console.error('Error saving predictions:', error)
    const saveBtn = document.getElementById('saveBtn')
    if (saveBtn) {
      saveBtn.disabled = false
      saveBtn.textContent = 'Save Predictions'
    }
    showToast('Error saving predictions', 'error')
  }
}

// Clear all predictions
async function clearPredictions () {
  if (isKnockoutLockedByAdmin()) {
    showToast('Knockout bets are locked by admin', 'error')
    return
  }

  if (!confirm('Are you sure you want to clear all predictions?')) {
    return
  }

  userPredictions = {}

  if (currentUser) {
    try {
      await remove(ref(db, `knockout_predictions/${currentUser.uid}`))
    } catch (error) {
      console.error('Error clearing predictions:', error)
    }
  }

  localStorage.removeItem('knockout_predictions')
  initializeBracket()
  showToast('All predictions cleared', 'success')
}

// Show toast notification
function showToast (message, type = 'success') {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message

  document.body.appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 3000)
}
