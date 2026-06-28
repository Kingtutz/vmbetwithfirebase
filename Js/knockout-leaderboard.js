import {
  getKnockoutLeaderboard,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  db
} from './firebase.js'
import {
  get,
  ref
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js'

const leaderboardContainer = document.getElementById('leaderboard')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const notice = document.getElementById('notice')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
const bracketModalBackdrop = document.getElementById('bracketModalBackdrop')
const bracketModal = document.getElementById('bracketModal')
const bracketModalClose = document.getElementById('bracketModalClose')
const bracketModalTitle = document.getElementById('bracketModalTitle')
const bracketModalBody = document.getElementById('bracketModalBody')
let currentUser = null

// ── Bracket modal ──────────────────────────────────────────────────────────

const ROUND_LABELS = {
  'round32-left': 'Round of 32',
  'round32-right': 'Round of 32',
  'round16-left': 'Round of 16',
  'round16-right': 'Round of 16',
  'quarterfinals-left': 'Quarterfinals',
  'quarterfinals-right': 'Quarterfinals',
  'semifinals-left': 'Semifinals',
  'semifinals-right': 'Semifinals',
  final: 'Final'
}

const ROUND_ORDER = [
  'round32-left',
  'round32-right',
  'round16-left',
  'round16-right',
  'quarterfinals-left',
  'quarterfinals-right',
  'semifinals-left',
  'semifinals-right',
  'final'
]

// Match data mirrors knockout-demo.js so we can resolve team names
const knockoutData = {
  'round32-left': [
    { team1: 'Germany', team2: 'Paraguay' },
    { team1: 'France', team2: 'Sweden' },
    { team1: 'South Africa', team2: 'Canada' },
    { team1: 'Netherlands', team2: 'Morocco' },
    { team1: 'Portugal', team2: 'Croatia' },
    { team1: 'Spain', team2: 'Austria' },
    { team1: 'United States', team2: 'Bosnia and Herzegovina' },
    { team1: 'Belgium', team2: 'Senegal' }
  ],
  'round32-right': [
    { team1: 'Brazil', team2: 'Japan' },
    { team1: 'Ivory Coast', team2: 'Norway' },
    { team1: 'Mexico', team2: 'Ecuador' },
    { team1: 'England', team2: 'DR Congo' },
    { team1: 'Argentina', team2: 'Cape Verde' },
    { team1: 'Australia', team2: 'Egypt' },
    { team1: 'Switzerland', team2: 'Algeria' },
    { team1: 'Colombia', team2: 'Ghana' }
  ],
  'round16-left': [
    { team1: 'W74', team2: 'W77' },
    { team1: 'W73', team2: 'W75' },
    { team1: 'W83', team2: 'W84' },
    { team1: 'W81', team2: 'W82' }
  ],
  'round16-right': [
    { team1: 'W76', team2: 'W78' },
    { team1: 'W79', team2: 'W80' },
    { team1: 'W86', team2: 'W88' },
    { team1: 'W85', team2: 'W87' }
  ],
  'quarterfinals-left': [
    { team1: 'W89', team2: 'W90' },
    { team1: 'W93', team2: 'W94' }
  ],
  'quarterfinals-right': [
    { team1: 'W91', team2: 'W92' },
    { team1: 'W95', team2: 'W96' }
  ],
  'semifinals-left': [{ team1: 'W97', team2: 'W98' }],
  'semifinals-right': [{ team1: 'W99', team2: 'W100' }],
  final: [{ team1: 'W101', team2: 'W102' }],
  thirdPlace: [{ team1: 'RU101', team2: 'RU102' }]
}

const openBracketModal = async (userId, displayName, stats = {}) => {
  bracketModalTitle.textContent = `${displayName}'s Bracket`
  bracketModalBody.innerHTML =
    '<p style="padding:8px 0;color:#888">Loading…</p>'
  bracketModal.style.display = ''
  bracketModalBackdrop.style.display = ''
  document.body.classList.add('leaderboard-modal-open')

  try {
    const snapshot = await get(ref(db, `knockout_predictions/${userId}`))
    const predictions = snapshot.exists() ? snapshot.val() : {}
    renderBracketModal(predictions, stats)
  } catch {
    bracketModalBody.innerHTML =
      '<p style="color:#c00">Could not load predictions.</p>'
  }
}

const closeBracketModal = () => {
  bracketModal.style.display = 'none'
  bracketModalBackdrop.style.display = 'none'
  document.body.classList.remove('leaderboard-modal-open')
}

const getPredictionForRoundMatch = (predictions, roundId, index) => {
  const keyA = `${roundId}_${index}`
  const altRound = roundId === 'thirdPlace' ? 'third-place' : roundId
  const keyB = `${altRound}_${index}`
  return predictions[keyA] || predictions[keyB] || {}
}

const deriveWinner = prediction => {
  const explicitRaw = String(prediction?.winner ?? '')
    .trim()
    .toLowerCase()
  const explicitNum = Number.parseInt(explicitRaw, 10)
  if (explicitNum === 1 || explicitRaw === 'team1' || explicitRaw === 'home') {
    return 1
  }
  if (explicitNum === 2 || explicitRaw === 'team2' || explicitRaw === 'away') {
    return 2
  }

  const parsed1 = Number.parseInt(String(prediction?.score1 ?? ''), 10)
  const parsed2 = Number.parseInt(String(prediction?.score2 ?? ''), 10)
  const hasScore1 = Number.isFinite(parsed1)
  const hasScore2 = Number.isFinite(parsed2)

  if (!hasScore1 && !hasScore2) return null

  const s1 = hasScore1 ? parsed1 : 0
  const s2 = hasScore2 ? parsed2 : 0
  if (s1 === s2) return null

  return s1 > s2 ? 1 : 2
}

const nextRoundInfo = (roundId, matchIndex) => {
  const map = {
    'round32-left': {
      round: 'round16-left',
      match: Math.floor(matchIndex / 2),
      slot: (matchIndex % 2) + 1
    },
    'round32-right': {
      round: 'round16-right',
      match: Math.floor(matchIndex / 2),
      slot: (matchIndex % 2) + 1
    },
    'round16-left': {
      round: 'quarterfinals-left',
      match: Math.floor(matchIndex / 2),
      slot: (matchIndex % 2) + 1
    },
    'round16-right': {
      round: 'quarterfinals-right',
      match: Math.floor(matchIndex / 2),
      slot: (matchIndex % 2) + 1
    },
    'quarterfinals-left': {
      round: 'semifinals-left',
      match: Math.floor(matchIndex / 2),
      slot: (matchIndex % 2) + 1
    },
    'quarterfinals-right': {
      round: 'semifinals-right',
      match: Math.floor(matchIndex / 2),
      slot: (matchIndex % 2) + 1
    },
    'semifinals-left': { round: 'final', match: 0, slot: 1 },
    'semifinals-right': { round: 'final', match: 0, slot: 2 }
  }

  return map[roundId] || null
}

const renderBracketModal = (predictions, stats = {}) => {
  const rounds = {
    'round32-left': knockoutData['round32-left'].map(m => ({ ...m })),
    'round16-left': knockoutData['round16-left'].map(m => ({ ...m })),
    'quarterfinals-left': knockoutData['quarterfinals-left'].map(m => ({
      ...m
    })),
    'semifinals-left': knockoutData['semifinals-left'].map(m => ({ ...m })),
    final: knockoutData.final.map(m => ({ ...m })),
    thirdPlace: knockoutData.thirdPlace.map(m => ({ ...m })),
    'semifinals-right': knockoutData['semifinals-right'].map(m => ({ ...m })),
    'quarterfinals-right': knockoutData['quarterfinals-right'].map(m => ({
      ...m
    })),
    'round16-right': knockoutData['round16-right'].map(m => ({ ...m })),
    'round32-right': knockoutData['round32-right'].map(m => ({ ...m }))
  }

  const processOrder = [
    'round32-left',
    'round32-right',
    'round16-left',
    'round16-right',
    'quarterfinals-left',
    'quarterfinals-right',
    'semifinals-left',
    'semifinals-right',
    'final',
    'thirdPlace'
  ]

  processOrder.forEach(roundId => {
    rounds[roundId].forEach((match, index) => {
      const prediction = getPredictionForRoundMatch(predictions, roundId, index)
      const winner = deriveWinner(prediction)

      match.score1 =
        prediction.score1 != null
          ? Number.parseInt(String(prediction.score1), 10) || 0
          : 0
      match.score2 =
        prediction.score2 != null
          ? Number.parseInt(String(prediction.score2), 10) || 0
          : 0
      match.hasScore = prediction.score1 != null || prediction.score2 != null
      match.winner = winner

      if (winner !== 1 && winner !== 2) return

      const winnerName = winner === 1 ? match.team1 : match.team2
      const loserName = winner === 1 ? match.team2 : match.team1
      const next = nextRoundInfo(roundId, index)

      if (next && rounds[next.round] && rounds[next.round][next.match]) {
        if (next.slot === 1) rounds[next.round][next.match].team1 = winnerName
        if (next.slot === 2) rounds[next.round][next.match].team2 = winnerName
      }

      if (roundId === 'semifinals-left' && rounds.thirdPlace[0]) {
        rounds.thirdPlace[0].team1 = loserName
      }
      if (roundId === 'semifinals-right' && rounds.thirdPlace[0]) {
        rounds.thirdPlace[0].team2 = loserName
      }
    })
  })

  const renderMatch = (match, roundId, index) => {
    const t1Class = match.winner === 1 ? 'ko-v-team winner-pick' : 'ko-v-team'
    const t2Class = match.winner === 2 ? 'ko-v-team winner-pick' : 'ko-v-team'
    const showScore = match.winner != null || match.hasScore

    return `
      <div class="ko-v-match" data-round="${roundId}" data-index="${index}">
        <div class="ko-v-row ${match.winner === 1 ? 'is-winner' : ''}">
          <span class="${t1Class}" title="${match.team1}">${match.team1}</span>
          ${showScore ? `<span class="ko-v-score">${match.score1}</span>` : ''}
        </div>
        <div class="ko-v-row ${match.winner === 2 ? 'is-winner' : ''}">
          <span class="${t2Class}" title="${match.team2}">${match.team2}</span>
          ${showScore ? `<span class="ko-v-score">${match.score2}</span>` : ''}
        </div>
      </div>
    `
  }

  const renderRoundColumn = (roundId, title) => `
    <div class="ko-v-round">
      <h4 class="ko-v-round-title">${title}</h4>
      ${rounds[roundId].map((m, i) => renderMatch(m, roundId, i)).join('')}
    </div>
  `

  bracketModalBody.innerHTML = `
    <div class="ko-v-summary">
      <span class="pick-right">Right winner: ${stats.winnerPoints ?? 0}</span>
      <span class="pick-right">Right score: ${stats.goalPoints ?? 0}</span>
      <span class="pick-wrong">Wrong: ${stats.wrongPoints ?? 0}</span>
    </div>

    <div class="ko-v-bracket">
      <div class="ko-v-side ko-v-left">
        ${renderRoundColumn('round32-left', 'Round of 32')}
        ${renderRoundColumn('round16-left', 'Round of 16')}
        ${renderRoundColumn('quarterfinals-left', 'Quarterfinals')}
        ${renderRoundColumn('semifinals-left', 'Semifinals')}
      </div>

      <div class="ko-v-center">
        ${renderRoundColumn('final', 'Final')}
        ${renderRoundColumn('thirdPlace', 'Play-off for third place')}
      </div>

      <div class="ko-v-side ko-v-right">
        ${renderRoundColumn('round32-right', 'Round of 32')}
        ${renderRoundColumn('round16-right', 'Round of 16')}
        ${renderRoundColumn('quarterfinals-right', 'Quarterfinals')}
        ${renderRoundColumn('semifinals-right', 'Semifinals')}
      </div>
    </div>
  `
}

bracketModalClose.addEventListener('click', closeBracketModal)
bracketModalBackdrop.addEventListener('click', closeBracketModal)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBracketModal()
})

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

const updateAdminTabVisibility = async user => {
  if (!adminNavLink) return
  const admin = await isAdminUser(user)
  adminNavLink.style.display = admin ? '' : 'none'
}

const formatUser = entry => {
  if (entry.nickname) return entry.nickname
  if (entry.email) return entry.email
  return `User ${String(entry.userId || '').slice(0, 8)}`
}

const renderLeaderboard = rows => {
  if (!rows.length) {
    leaderboardContainer.innerHTML = '<p>No knockout predictions yet.</p>'
    return
  }

  leaderboardContainer.innerHTML = rows
    .map((entry, index) => {
      return `
        <div class="leaderboard-row" data-uid="${
          entry.userId
        }" data-name="${formatUser(
        entry
      )}" data-winner-points="${entry.winnerPoints}" data-goal-points="${
        entry.goalPoints
      }" data-wrong-points="${entry.wrongPoints ?? 0}" style="cursor:pointer" title="Click to view bracket">
          <div class="place">#${index + 1}</div>
          <div class="player">
            <span class="player-name">${formatUser(entry)}</span>
            <div class="pick-balance">
              <span class="pick-right">Right winner: ${entry.winnerPoints}</span>
              <span class="pick-right">Right score: ${entry.goalPoints}</span>
            </div>
          </div>
          <div class="stats">
            <span class="points">${entry.points} pts</span>
            <span class="meta">${entry.predictionsCount} picks</span>
            <span class="meta">${entry.resolvedMatchesCount} scored</span>
          </div>
        </div>
      `
    })
    .join('')

  leaderboardContainer.querySelectorAll('.leaderboard-row').forEach(row => {
    row.addEventListener('click', () => {
      openBracketModal(row.dataset.uid, row.dataset.name, {
        winnerPoints: Number.parseInt(row.dataset.winnerPoints || '0', 10) || 0,
        goalPoints: Number.parseInt(row.dataset.goalPoints || '0', 10) || 0,
        wrongPoints: Number.parseInt(row.dataset.wrongPoints || '0', 10) || 0
      })
    })
  })
}

const run = async () => {
  try {
    const rows = await getKnockoutLeaderboard()
    notice.style.display = 'none'
    renderLeaderboard(rows)
  } catch (error) {
    notice.style.display = 'block'
    notice.textContent = error.message || 'Could not load knockout leaderboard.'
    leaderboardContainer.innerHTML = ''
  }
}

logoutBtn.addEventListener('click', async () => {
  if (!currentUser) {
    window.location.href = 'login.html'
    return
  }

  try {
    await logOut()
    window.location.href = 'login.html'
  } catch (error) {
    notice.style.display = 'block'
    notice.textContent = error.message || 'Logout failed.'
  }
})

onAuthChange(async user => {
  currentUser = user || null

  if (!user) {
    await updateAdminTabVisibility(null)
    if (userEmail) userEmail.textContent = 'Guest'
    logoutBtn.textContent = 'Login'
    run()
    return
  }

  logoutBtn.textContent = 'Logout'
  await updateAdminTabVisibility(user)
  const profile = await getUserProfile(user.uid)
  if (userEmail)
    userEmail.textContent = profile.nickname || user.email || 'User'
  run()
})
