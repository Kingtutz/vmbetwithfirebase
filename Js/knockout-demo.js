import { auth, db, getBetLocks, isAdminUser } from './firebase.js'
import { knockoutData as sharedKnockoutData } from './knockout-data.js'
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

// Use the same knockout ordering as admin/toplist so match ids map correctly.
const knockoutData = {
  ...sharedKnockoutData,
  thirdPlace: [
    {
      team1: 'RU101',
      team2: 'RU102',
      date: 'July 18',
      location: 'East Rutherford'
    }
  ]
}

let currentUser = null
let userPredictions = {}
let betLocks = {
  matchesLockedAt: '',
  winnerLockedAt: '',
  knockoutLockedAt: '',
  knockoutRound32LockedAt: '',
  knockoutRestLockedAt: ''
}
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
let bracketConnectionFrame = null

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

async function updateAdminTabVisibility (user) {
  if (!adminNavLink) return
  const admin = await isAdminUser(user)
  adminNavLink.style.display = admin ? '' : 'none'
}

function isLockActive (lockAt) {
  const value = String(lockAt || '')
  if (!value) return false

  const lockTime = new Date(value).getTime()
  if (Number.isNaN(lockTime)) return false
  return Date.now() >= lockTime
}

function isRound32Match (matchId) {
  return String(matchId || '').startsWith('round32-')
}

function isKnockoutMatchLockedByAdmin (matchId) {
  if (isRound32Match(matchId)) {
    return isLockActive(
      betLocks.knockoutRound32LockedAt || betLocks.knockoutLockedAt
    )
  }

  return isLockActive(betLocks.knockoutRestLockedAt)
}

function isAnyKnockoutLockedByAdmin () {
  return (
    isLockActive(
      betLocks.knockoutRound32LockedAt || betLocks.knockoutLockedAt
    ) || isLockActive(betLocks.knockoutRestLockedAt)
  )
}

function getKnockoutLockMessage (matchId) {
  if (isRound32Match(matchId)) {
    return 'Round of 32 knockout bets are locked by admin'
  }
  return 'Knockout bets after Round of 32 are locked by admin'
}

function renderLockState () {
  const anyLocked = isAnyKnockoutLockedByAdmin()
  const saveBtn = document.getElementById('saveBtn')
  const clearBtn = document.getElementById('clearBtn')
  const lockStatus = document.getElementById('lockStatus')

  // Save stays available so users can still submit unlocked rounds.
  if (saveBtn) saveBtn.disabled = false
  if (clearBtn) clearBtn.disabled = anyLocked

  if (lockStatus) {
    lockStatus.style.display = anyLocked ? 'block' : 'none'

    const messages = []
    if (
      isLockActive(
        betLocks.knockoutRound32LockedAt || betLocks.knockoutLockedAt
      )
    ) {
      messages.push('Round of 32 knockout bets are locked by admin.')
    }
    if (isLockActive(betLocks.knockoutRestLockedAt)) {
      messages.push('Knockout bets after Round of 32 are locked by admin.')
    }

    lockStatus.textContent = messages.join(' ')
  }
}

async function loadBetLocks () {
  try {
    const locks = await getBetLocks()
    betLocks = {
      matchesLockedAt: String(locks?.matchesLockedAt || ''),
      winnerLockedAt: String(locks?.winnerLockedAt || ''),
      knockoutLockedAt: String(locks?.knockoutLockedAt || ''),
      knockoutRound32LockedAt: String(
        locks?.knockoutRound32LockedAt || locks?.knockoutLockedAt || ''
      ),
      knockoutRestLockedAt: String(locks?.knockoutRestLockedAt || '')
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

  window.addEventListener('resize', scheduleBracketConnections)
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
  renderRound(
    'third-place',
    knockoutData.thirdPlace,
    'third-place',
    'Play-off for third place'
  )

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
  updateThirdPlaceMatch()
  scheduleBracketConnections()
}

// Render a round of matches
function renderRound (containerId, matches, roundPrefix, roundName) {
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`Container not found: ${containerId}`)
    return
  }

  container.innerHTML = `<h3>${roundName}</h3>`
  const heading = container.querySelector('h3')

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

  // Actual R32 step = matchHeight(82) + inlineMarginBottom(8) + cssGap(8) = 98px
  // Each subsequent round's step = 2^n * 98, so every match stays centered between feeders.
  // firstMatchOffset places the first match at the vertical center of its two R32 feeders:
  //   R16 offset = 98/2 - matchHeight/2 = 49 - 41 = (centered between R32 pair 0&1)
  //   QF offset  = R16_offset + R16_step/2 = 49 + 98 = 147
  //   SF offset  = QF_offset  + QF_step/2  = 147 + 196 = 343
  //   Final      = raised so semis sit midpoint between Final and 3rd-place = 230
  const FIRST_MATCH_OFFSET = {
    'round16-left': 49,
    'round16-right': 49,
    'quarterfinals-left': 147,
    'quarterfinals-right': 147,
    'semifinals-left': 343,
    'semifinals-right': 343,
    final: 230
  }
  const firstMatchOffset = FIRST_MATCH_OFFSET[roundPrefix] || 0

  if (heading && firstMatchOffset > 0) {
    heading.style.marginTop = `${firstMatchOffset}px`
  }

  matches.forEach((match, index) => {
    try {
      const matchId = `${roundPrefix}_${index}`
      const matchDiv = createMatchElement(match, matchId)

      // marginBottom formula: step - matchHeight - cssGap
      // step = 98 * spacingMultiplier, cssGap = 8 (from .round { gap: 0.5rem })
      const baseMatchStep = 98
      const cssGap = 8
      const matchHeight = 82
      const step = baseMatchStep * spacingMultiplier
      // heading already carries the offset; first match needs no extra top margin
      if (index === 0) {
        matchDiv.style.marginTop = '0px'
      }
      if (index < matches.length - 1) {
        matchDiv.style.marginBottom =
          Math.max(0, step - matchHeight - cssGap) + 'px'
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
  const parsedWinner = Number.parseInt(String(prediction.winner ?? ''), 10)
  const parsedScore1 = Number.parseInt(String(prediction.score1 ?? ''), 10)
  const parsedScore2 = Number.parseInt(String(prediction.score2 ?? ''), 10)
  const derivedWinner =
    Number.isFinite(parsedScore1) &&
    Number.isFinite(parsedScore2) &&
    parsedScore1 !== parsedScore2
      ? parsedScore1 > parsedScore2
        ? 1
        : 2
      : null
  const winner =
    parsedWinner === 1 || parsedWinner === 2 ? parsedWinner : derivedWinner
  const score1 = prediction.score1 || 0
  const score2 = prediction.score2 || 0

  if (
    parsedWinner !== 1 &&
    parsedWinner !== 2 &&
    (winner === 1 || winner === 2)
  ) {
    prediction.winner = winner
    userPredictions[matchId] = prediction
  }

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
  team1Div.querySelector('.team-selector').addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    if (isKnockoutMatchLockedByAdmin(matchId)) {
      showToast(getKnockoutLockMessage(matchId), 'error')
      return
    }
    const score = prompt(`Enter score for ${match.team1}:`, score1)
    if (score !== null && score !== '') {
      const pred = userPredictions[matchId] || {}
      pred.score1 = Math.max(0, parseInt(score) || 0)
      userPredictions[matchId] = pred
      team1Div.querySelector('.score').textContent = pred.score1
      applyWinnerFromScores(matchId, matchDiv)
      updateMatchStatus(matchDiv)
    }
  })

  team2Div.querySelector('.team-selector').addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    if (isKnockoutMatchLockedByAdmin(matchId)) {
      showToast(getKnockoutLockMessage(matchId), 'error')
      return
    }
    const score = prompt(`Enter score for ${match.team2}:`, score2)
    if (score !== null && score !== '') {
      const pred = userPredictions[matchId] || {}
      pred.score2 = Math.max(0, parseInt(score) || 0)
      userPredictions[matchId] = pred
      team2Div.querySelector('.score').textContent = pred.score2
      applyWinnerFromScores(matchId, matchDiv)
      updateMatchStatus(matchDiv)
    }
  })

  updateMatchStatus(matchDiv)
  return matchDiv
}

function applyWinnerFromScores (matchId, matchDiv) {
  const prediction = userPredictions[matchId] || {}
  const score1 = Number.parseInt(String(prediction.score1 ?? ''), 10)
  const score2 = Number.parseInt(String(prediction.score2 ?? ''), 10)

  if (
    !Number.isFinite(score1) ||
    !Number.isFinite(score2) ||
    score1 === score2
  ) {
    return
  }

  const winnerFromScore = score1 > score2 ? 1 : 2
  if (prediction.winner === winnerFromScore) return

  prediction.winner = winnerFromScore
  userPredictions[matchId] = prediction

  const buttons = matchDiv.querySelectorAll('.team-selector')
  buttons.forEach(btn => {
    const btnTeam = parseInt(btn.getAttribute('data-team'))
    btn.classList.toggle('selected', btnTeam === prediction.winner)
  })

  const teamRows = matchDiv.querySelectorAll('.team-box')
  teamRows.forEach((row, idx) => {
    row.classList.toggle('selected', prediction.winner === idx + 1)
  })

  const currentRound = matchDiv.parentElement.id
  advanceTeam(matchId, winnerFromScore, currentRound)
  updateThirdPlaceMatch()
  scheduleBracketConnections()
}

// Select a winner and advance to next round
function selectWinner (matchId, winner, matchDiv) {
  if (isKnockoutMatchLockedByAdmin(matchId)) {
    showToast(getKnockoutLockMessage(matchId), 'error')
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

  updateThirdPlaceMatch()
  scheduleBracketConnections()
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

function updateThirdPlaceMatch () {
  const thirdPlaceContainer = document.getElementById('third-place')
  if (!thirdPlaceContainer) return

  const thirdPlaceMatch = thirdPlaceContainer.querySelector('.match-box')
  if (!thirdPlaceMatch) return

  const leftSemi = document.querySelector('#semifinals-left .match-box')
  const rightSemi = document.querySelector('#semifinals-right .match-box')

  const getLoserName = (roundId, matchBox, fallbackTeamIndex) => {
    if (!matchBox) return null

    const prediction = userPredictions[`${roundId}_0`] || {}
    const teams = matchBox.querySelectorAll('.team-name')
    const team1 = teams[0]?.textContent?.trim() || ''
    const team2 = teams[1]?.textContent?.trim() || ''

    if (prediction.winner === 1) return team2 || null
    if (prediction.winner === 2) return team1 || null

    const placeholder = knockoutData.thirdPlace[0]
    return fallbackTeamIndex === 1
      ? placeholder?.team1 || null
      : placeholder?.team2 || null
  }

  const leftLoser = getLoserName('semifinals-left', leftSemi, 1)
  const rightLoser = getLoserName('semifinals-right', rightSemi, 2)

  const teamNameSpans = thirdPlaceMatch.querySelectorAll('.team-name')
  if (teamNameSpans[0] && leftLoser) {
    teamNameSpans[0].textContent = leftLoser
    teamNameSpans[0].title = leftLoser
  }
  if (teamNameSpans[1] && rightLoser) {
    teamNameSpans[1].textContent = rightLoser
    teamNameSpans[1].title = rightLoser
  }
}

function scheduleBracketConnections () {
  if (bracketConnectionFrame) {
    cancelAnimationFrame(bracketConnectionFrame)
  }

  bracketConnectionFrame = requestAnimationFrame(() => {
    bracketConnectionFrame = null
    renderBracketConnections()
  })
}

function renderBracketConnections () {
  const container = document.querySelector('.bracket-container')
  if (!container) return

  let svg = container.querySelector('.bracket-connections')
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.classList.add('bracket-connections')
    container.prepend(svg)
  }

  const width = Math.max(container.scrollWidth, container.clientWidth)
  const height = Math.max(container.scrollHeight, container.clientHeight)
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.innerHTML = ''

  const ns = 'http://www.w3.org/2000/svg'
  const containerRect = container.getBoundingClientRect()

  const pointFor = (element, anchor) => {
    const rect = element.getBoundingClientRect()
    const left = rect.left - containerRect.left + container.scrollLeft
    const top = rect.top - containerRect.top + container.scrollTop
    const right = left + rect.width
    const bottom = top + rect.height
    const centerX = left + rect.width / 2
    const centerY = top + rect.height / 2

    switch (anchor) {
      case 'left':
        return { x: left, y: centerY }
      case 'right':
        return { x: right, y: centerY }
      case 'top':
        return { x: centerX, y: top }
      case 'bottom':
        return { x: centerX, y: bottom }
      default:
        return { x: centerX, y: centerY }
    }
  }

  const addPath = (fromEl, fromAnchor, toEl, toAnchor, extraClass = '') => {
    if (!fromEl || !toEl) return

    const start = pointFor(fromEl, fromAnchor)
    const end = pointFor(toEl, toAnchor)
    const midX = (start.x + end.x) / 2

    const path = document.createElementNS(ns, 'path')
    path.setAttribute(
      'd',
      `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`
    )
    if (extraClass) path.setAttribute('class', extraClass)
    svg.appendChild(path)
  }

  const addVerticalPath = (fromEl, toEl, extraClass = '') => {
    if (!fromEl || !toEl) return

    const start = pointFor(fromEl, 'bottom')
    const end = pointFor(toEl, 'top')
    const midY = (start.y + end.y) / 2

    const path = document.createElementNS(ns, 'path')
    path.setAttribute(
      'd',
      `M ${start.x} ${start.y} V ${midY} H ${end.x} V ${end.y}`
    )
    if (extraClass) path.setAttribute('class', extraClass)
    svg.appendChild(path)
  }

  const connectSeries = (
    sourceRound,
    targetRound,
    sourceAnchor,
    targetAnchor,
    pairMap
  ) => {
    pairMap.forEach(([sourceIndex, targetIndex]) => {
      const sourceEl = document.getElementById(`${sourceRound}_${sourceIndex}`)
      const targetEl = document.getElementById(`${targetRound}_${targetIndex}`)
      addPath(sourceEl, sourceAnchor, targetEl, targetAnchor)
    })
  }

  connectSeries('round32-left', 'round16-left', 'right', 'left', [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [7, 3]
  ])
  connectSeries('round32-right', 'round16-right', 'left', 'right', [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [7, 3]
  ])

  connectSeries('round16-left', 'quarterfinals-left', 'right', 'left', [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1]
  ])
  connectSeries('round16-right', 'quarterfinals-right', 'left', 'right', [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1]
  ])

  connectSeries('quarterfinals-left', 'semifinals-left', 'right', 'left', [
    [0, 0],
    [1, 0]
  ])
  connectSeries('quarterfinals-right', 'semifinals-right', 'left', 'right', [
    [0, 0],
    [1, 0]
  ])

  addPath(
    document.getElementById('semifinals-left_0'),
    'right',
    document.getElementById('final_0'),
    'left'
  )
  addPath(
    document.getElementById('semifinals-right_0'),
    'left',
    document.getElementById('final_0'),
    'right'
  )

  addVerticalPath(
    document.getElementById('semifinals-left_0'),
    document.getElementById('third-place_0'),
    'third-place'
  )
  addVerticalPath(
    document.getElementById('semifinals-right_0'),
    document.getElementById('third-place_0'),
    'third-place'
  )
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
  if (isAnyKnockoutLockedByAdmin()) {
    showToast('Cannot clear all while knockout locks are active', 'error')
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
