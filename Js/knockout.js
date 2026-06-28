import { auth, db } from './firebase.js'
import {
  ref,
  get,
  set,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js'

// Tournament knockout structure with actual 2026 World Cup seeding
const knockoutData = {
  round32: [
    {
      team1: 'Germany',
      team2: 'Paraguay',
      date: 'June 29',
      location: 'Houston'
    },
    {
      team1: 'France',
      team2: 'Sweden',
      date: 'June 30',
      location: 'Arlington'
    },
    {
      team1: 'South Africa',
      team2: 'Canada',
      date: 'June 28',
      location: 'Inglewood'
    },
    {
      team1: 'Netherlands',
      team2: 'Morocco',
      date: 'June 29',
      location: 'Guadalupe'
    },
    {
      team1: 'Portugal',
      team2: 'Croatia',
      date: 'July 2',
      location: 'Inglewood'
    },
    {
      team1: 'Spain',
      team2: 'Austria',
      date: 'July 2',
      location: 'Santa Clara'
    },
    {
      team1: 'United States',
      team2: 'Bosnia and Herzegovina',
      date: 'July 1',
      location: 'Seattle'
    },
    { team1: 'Belgium', team2: 'Senegal', date: 'July 1', location: 'Seattle' },
    { team1: 'Brazil', team2: 'Japan', date: 'June 29', location: 'Houston' },
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
    {
      team1: 'Argentina',
      team2: 'Cape Verde',
      date: 'July 3',
      location: 'Arlington'
    },
    {
      team1: 'Australia',
      team2: 'Egypt',
      date: 'July 3',
      location: 'Vancouver'
    },
    {
      team1: 'Switzerland',
      team2: 'Algeria',
      date: 'July 2',
      location: 'Vancouver'
    },
    {
      team1: 'Colombia',
      team2: 'Ghana',
      date: 'July 3',
      location: 'Miami Gardens'
    }
  ],
  round16: [
    { team1: 'W74', team2: 'W77', date: 'July 4', location: 'Philadelphia' },
    { team1: 'W73', team2: 'W75', date: 'July 4', location: 'Houston' },
    { team1: 'W83', team2: 'W84', date: 'July 6', location: 'Mexico City' },
    { team1: 'W81', team2: 'W82', date: 'July 6', location: 'Seattle' },
    { team1: 'W76', team2: 'W78', date: 'July 5', location: 'East Rutherford' },
    { team1: 'W79', team2: 'W80', date: 'July 5', location: 'Mexico City' },
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async user => {
    if (user) {
      currentUser = user
      document.getElementById('userEmail').textContent = user.email
      await loadUserPredictions()
      initializeBracket()
    } else {
      window.location.href = 'login.html'
    }
  })

  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOut(auth).then(() => {
        window.location.href = 'login.html'
      })
    })
  }

  document.getElementById('saveBtn').addEventListener('click', savePredictions)
  document
    .getElementById('clearBtn')
    .addEventListener('click', clearPredictions)
})

// Initialize the bracket display
function initializeBracket () {
  renderRound('round32', knockoutData.round32, 'round32')
  renderRound('round16', knockoutData.round16, 'round16')
  renderRound('quarterfinals', knockoutData.quarterfinals, 'quarterfinals')
  renderRound('semifinals', knockoutData.semifinals, 'semifinals')
  renderRound('final', knockoutData.final, 'final')
}

// Render a round of matches
function renderRound (containerId, matches, roundPrefix) {
  const container = document.getElementById(containerId)
  if (!container) return

  container.innerHTML = ''

  matches.forEach((match, index) => {
    const matchId = `${roundPrefix}_${index}`
    const matchDiv = createMatchElement(match, matchId)
    container.appendChild(matchDiv)
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
  team1Div.className = 'team-box'
  team1Div.innerHTML = `
    <span class="team-name">${match.team1}</span>
    <button class="team-selector ${
      isTeam1Selected ? 'selected' : ''
    }" data-match="${matchId}" data-team="1">
      <span class="score">${score1}</span>
    </button>
  `

  // Team 2
  const team2Div = document.createElement('div')
  team2Div.className = 'team-box'
  team2Div.innerHTML = `
    <span class="team-name">${match.team2}</span>
    <button class="team-selector ${
      isTeam2Selected ? 'selected' : ''
    }" data-match="${matchId}" data-team="2">
      <span class="score">${score2}</span>
    </button>
  `

  matchDiv.appendChild(team1Div)
  matchDiv.appendChild(team2Div)

  // Add event listeners for team selection
  team1Div.querySelector('.team-selector').addEventListener('click', () => {
    selectWinner(matchId, 1, matchDiv)
  })

  team2Div.querySelector('.team-selector').addEventListener('click', () => {
    selectWinner(matchId, 2, matchDiv)
  })

  // Add double-click to edit score
  team1Div.addEventListener('dblclick', () => {
    const score = prompt(`Enter score for ${match.team1}:`, score1)
    if (score !== null && score !== '') {
      const pred = userPredictions[matchId] || {}
      pred.score1 = Math.max(0, parseInt(score) || 0)
      userPredictions[matchId] = pred
      team1Div.querySelector('.score').textContent = pred.score1
      updateMatchStatus(matchDiv)
    }
  })

  team2Div.addEventListener('dblclick', () => {
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

// Select a winner
function selectWinner (matchId, winner, matchDiv) {
  const prediction = userPredictions[matchId] || {}

  if (prediction.winner === winner) {
    prediction.winner = null
  } else {
    prediction.winner = winner
  }

  userPredictions[matchId] = prediction

  // Update UI buttons
  const buttons = matchDiv.querySelectorAll('.team-selector')
  buttons.forEach(btn => {
    const btnTeam = parseInt(btn.getAttribute('data-team'))
    if (btnTeam === prediction.winner) {
      btn.classList.add('selected')
    } else {
      btn.classList.remove('selected')
    }
  })

  updateMatchStatus(matchDiv)
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

// Load user predictions from Firebase
async function loadUserPredictions () {
  try {
    const userRef = ref(db, `knockout_predictions/${currentUser.uid}`)
    const snapshot = await get(userRef)

    if (snapshot.exists()) {
      userPredictions = snapshot.val()
    } else {
      userPredictions = {}
    }
  } catch (error) {
    console.error('Error loading predictions:', error)
    showToast('Error loading predictions', 'error')
  }
}

// Save predictions to Firebase
async function savePredictions () {
  try {
    const saveBtn = document.getElementById('saveBtn')
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving...'

    const userRef = ref(db, `knockout_predictions/${currentUser.uid}`)
    await set(userRef, userPredictions)

    saveBtn.disabled = false
    saveBtn.textContent = 'Save Predictions'
    showToast('Predictions saved successfully!', 'success')
  } catch (error) {
    console.error('Error saving predictions:', error)
    document.getElementById('saveBtn').disabled = false
    document.getElementById('saveBtn').textContent = 'Save Predictions'
    showToast('Error saving predictions', 'error')
  }
}

// Clear all predictions
function clearPredictions () {
  if (confirm('Are you sure you want to clear all predictions?')) {
    userPredictions = {}
    document.querySelectorAll('.match-box').forEach(match => {
      match.classList.remove('completed')
      match.querySelectorAll('.team-selector').forEach(btn => {
        btn.classList.remove('selected')
        btn.querySelector('.score').textContent = '0'
      })
    })
    showToast('All predictions cleared', 'success')
  }
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

export { knockoutData, userPredictions }
