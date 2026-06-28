let auth = null
let db = null
let ref = null
let get_ = null
let set_ = null
let onAuthStateChanged_ = null
let signOut_ = null

// Initialize Firebase asynchronously
async function initializeFirebase() {
  try {
    const { auth: authImport, db: dbImport } = await import('./firebase.js')
    auth = authImport
    db = dbImport
    
    const firebaseDb = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js')
    ref = firebaseDb.ref
    get_ = firebaseDb.get
    set_ = firebaseDb.set
    
    const firebaseAuth = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js')
    onAuthStateChanged_ = firebaseAuth.onAuthStateChanged
    signOut_ = firebaseAuth.signOut
    
    console.log('Firebase initialized successfully')
    return true
  } catch (error) {
    console.warn('Firebase not available, running in demo mode:', error)
    return false
  }
}

// Tournament knockout structure with actual 2026 World Cup seeding
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded - Initializing Firebase')
  
  const firebaseAvailable = await initializeFirebase()
  
  if (firebaseAvailable && onAuthStateChanged_) {
    let authCheckTimeout = setTimeout(() => {
      console.log('Auth check timeout - showing demo bracket')
      initializeBracket()
    }, 3000)
    
    onAuthStateChanged_(auth, async user => {
      clearTimeout(authCheckTimeout)
      console.log('Auth state changed:', user ? user.email : 'No user')
      
      if (user) {
        currentUser = user
        const emailEl = document.getElementById('userEmail')
        if (emailEl) {
          emailEl.textContent = user.email
        }
        
        try {
          await loadUserPredictions()
          console.log('Predictions loaded:', userPredictions)
          initializeBracket()
          console.log('Bracket initialized')
        } catch (error) {
          console.error('Error initializing bracket:', error)
          initializeBracket() // Show demo even on error
        }
      } else {
        console.log('No user logged in - showing demo bracket')
        const emailEl = document.getElementById('userEmail')
        if (emailEl) {
          emailEl.textContent = 'Demo Mode'
        }
        initializeBracket() // Show demo bracket
      }
    })
  } else {
    console.log('Firebase not available - showing demo bracket immediately')
    const emailEl = document.getElementById('userEmail')
    if (emailEl) {
      emailEl.textContent = 'Demo Mode'
    }
    initializeBracket()
  }

  // Setup button listeners
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (firebaseAvailable && signOut_) {
        signOut_(auth).then(() => {
          window.location.href = 'login.html'
        }).catch(error => {
          console.error('Logout error:', error)
          window.location.href = 'login.html'
        })
      } else {
        window.location.href = 'login.html'
      }
    })
  }

  const saveBtn = document.getElementById('saveBtn')
  if (saveBtn) {
    saveBtn.addEventListener('click', savePredictions)
  }
  
  const clearBtn = document.getElementById('clearBtn')
  if (clearBtn) {
    clearBtn.addEventListener('click', clearPredictions)
  }
})

// Initialize the bracket display
function initializeBracket() {
  console.log('Initializing bracket with rounds:', Object.keys(knockoutData))
  
  renderRound('round32', knockoutData.round32, 'round32', 'Round of 32')
  renderRound('round16', knockoutData.round16, 'round16', 'Round of 16')
  renderRound('quarterfinals', knockoutData.quarterfinals, 'quarterfinals', 'Quarterfinals')
  renderRound('semifinals', knockoutData.semifinals, 'semifinals', 'Semifinals')
  renderRound('final', knockoutData.final, 'final', 'Final')
}

// Render a round of matches
function renderRound(containerId, matches, roundPrefix, roundName) {
  const container = document.getElementById(containerId)
  console.log(`Rendering ${roundName}:`, containerId, 'Container found:', !!container, 'Matches:', matches.length)
  
  if (!container) {
    console.error(`Container not found: ${containerId}`)
    return
  }

  container.innerHTML = `<h3 style="color: #4caf50; text-align: center; margin-bottom: 1rem;">${roundName}</h3>`

  matches.forEach((match, index) => {
    try {
      const matchId = `${roundPrefix}_${index}`
      const matchDiv = createMatchElement(match, matchId)
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
  if (!db || !get_ || !currentUser) {
    console.log('Firebase not available or no user, skipping load')
    userPredictions = {}
    return
  }
  
  try {
    const userRef = ref(db, `knockout_predictions/${currentUser.uid}`)
    const snapshot = await get_(userRef)

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
  if (!db || !set_ || !currentUser) {
    console.log('Firebase not available - saving to local storage')
    localStorage.setItem('knockout_predictions', JSON.stringify(userPredictions))
    showToast('Predictions saved locally (not synced to server)', 'success')
    return
  }
  
  try {
    const saveBtn = document.getElementById('saveBtn')
    saveBtn.disabled = true
    saveBtn.textContent = 'Saving...'

    const userRef = ref(db, `knockout_predictions/${currentUser.uid}`)
    await set_(userRef, userPredictions)

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
