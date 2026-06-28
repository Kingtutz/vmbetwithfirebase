import {
  db,
  getKnockoutToplist,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange
} from './firebase.js'
import { knockoutData as sharedKnockoutData } from './knockout-data.js'
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

const knockoutData = {
  'round32-left': sharedKnockoutData.round32.slice(0, 8),
  'round32-right': sharedKnockoutData.round32.slice(8, 16),
  'round16-left': sharedKnockoutData.round16.slice(0, 4),
  'round16-right': sharedKnockoutData.round16.slice(4, 8),
  'quarterfinals-left': sharedKnockoutData.quarterfinals.slice(0, 2),
  'quarterfinals-right': sharedKnockoutData.quarterfinals.slice(2, 4),
  'semifinals-left': sharedKnockoutData.semifinals.slice(0, 1),
  'semifinals-right': sharedKnockoutData.semifinals.slice(1, 2),
  final: sharedKnockoutData.final,
  'third-place': [{ team1: 'RU101', team2: 'RU102' }]
}

const compatibilityMap = {
  'round32-left_0': 'round32-left_1',
  'round32-left_1': 'round32-left_4',
  'round32-left_2': 'round32-left_0',
  'round32-left_3': 'round32-left_2',
  'round32-left_4': 'round32-right_3',
  'round32-left_5': 'round32-right_2',
  'round32-left_6': 'round32-right_1',
  'round32-left_7': 'round32-right_0',
  'round32-right_0': 'round32-left_3',
  'round32-right_1': 'round32-left_5',
  'round32-right_2': 'round32-left_6',
  'round32-right_3': 'round32-left_7',
  'round32-right_4': 'round32-right_6',
  'round32-right_5': 'round32-right_5',
  'round32-right_6': 'round32-right_4',
  'round32-right_7': 'round32-right_7',
  'round16-left_0': 'round16-left_1',
  'round16-left_1': 'round16-left_0',
  'round16-left_2': 'round16-right_0',
  'round16-left_3': 'round16-right_1',
  'round16-right_0': 'round16-left_2',
  'round16-right_1': 'round16-left_3',
  'round16-right_2': 'round16-right_2',
  'round16-right_3': 'round16-right_3'
}

const toNumber = value => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeWinner = value => {
  const clean = String(value ?? '')
    .trim()
    .toLowerCase()

  if (clean === '1' || clean === 'team1' || clean === 'home') return 'team1'
  if (clean === '2' || clean === 'team2' || clean === 'away') return 'team2'
  if (clean === 'draw' || clean === 'x') return 'draw'
  return clean
}

const winnerFromScores = (score1, score2) => {
  if (score1 === null || score2 === null) return ''
  if (score1 > score2) return 'team1'
  if (score2 > score1) return 'team2'
  return 'draw'
}

const resolveWinner = (scoreWinner, fieldWinner) => {
  if (scoreWinner === 'draw') {
    if (fieldWinner === 'team1' || fieldWinner === 'team2') return fieldWinner
    return 'draw'
  }
  return scoreWinner || fieldWinner
}

const resultForMatch = (resultsByMatch, matchId) => {
  const directPrefixed = resultsByMatch[`knockout-${matchId}`]
  if (directPrefixed) return directPrefixed

  const direct = resultsByMatch[matchId]
  if (direct) return direct

  const mapped = compatibilityMap[matchId]
  if (!mapped) return null

  const mappedPrefixed = resultsByMatch[`knockout-${mapped}`]
  if (mappedPrefixed) return mappedPrefixed

  const mappedDirect = resultsByMatch[mapped]
  if (mappedDirect) return mappedDirect

  return null
}

const getPredictionForRoundMatch = (predictions, roundId, index) => {
  const keyA = `${roundId}_${index}`
  return predictions[keyA] || {}
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

const renderBracketModal = (predictions, resultsByMatch = {}) => {
  const rounds = {
    'round32-left': knockoutData['round32-left'].map(m => ({ ...m })),
    'round16-left': knockoutData['round16-left'].map(m => ({ ...m })),
    'quarterfinals-left': knockoutData['quarterfinals-left'].map(m => ({
      ...m
    })),
    'semifinals-left': knockoutData['semifinals-left'].map(m => ({ ...m })),
    final: knockoutData.final.map(m => ({ ...m })),
    'third-place': knockoutData['third-place'].map(m => ({ ...m })),
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
    'third-place'
  ]

  processOrder.forEach(roundId => {
    rounds[roundId].forEach((match, index) => {
      const prediction = getPredictionForRoundMatch(predictions, roundId, index)
      const winner = deriveWinner(prediction)
      const parsedScore1 = Number.parseInt(String(prediction.score1 ?? ''), 10)
      const parsedScore2 = Number.parseInt(String(prediction.score2 ?? ''), 10)
      const hasScore1 = Number.isFinite(parsedScore1)
      const hasScore2 = Number.isFinite(parsedScore2)

      match.score1 = hasScore1 ? parsedScore1 : ''
      match.score2 = hasScore2 ? parsedScore2 : ''
      match.hasScore = hasScore1 || hasScore2
      match.winner = winner

      const matchId = `${roundId}_${index}`
      const result = resultForMatch(resultsByMatch, matchId)
      if (result) {
        const p1 = toNumber(prediction.score1)
        const p2 = toNumber(prediction.score2)
        const r1 = toNumber(result.score1)
        const r2 = toNumber(result.score2)

        const predWinner = resolveWinner(
          winnerFromScores(p1, p2),
          normalizeWinner(prediction.winner)
        )
        const officialWinner = resolveWinner(
          winnerFromScores(r1, r2),
          normalizeWinner(result.winner)
        )

        const winnerCorrect =
          Boolean(predWinner) &&
          Boolean(officialWinner) &&
          predWinner === officialWinner
        const score1Correct = r1 !== null && p1 !== null && p1 === r1
        const score2Correct = r2 !== null && p2 !== null && p2 === r2
        const points =
          (winnerCorrect ? 1 : 0) +
          (score1Correct ? 1 : 0) +
          (score2Correct ? 1 : 0)

        match.scoring = {
          winnerPicked: Boolean(predWinner),
          winnerCorrect,
          score1Picked: p1 !== null,
          score2Picked: p2 !== null,
          score1Correct,
          score2Correct,
          points
        }
      } else {
        match.scoring = null
      }

      if (winner !== 1 && winner !== 2) return

      const winnerName = winner === 1 ? match.team1 : match.team2
      const loserName = winner === 1 ? match.team2 : match.team1
      const next = nextRoundInfo(roundId, index)

      if (next && rounds[next.round] && rounds[next.round][next.match]) {
        if (next.slot === 1) rounds[next.round][next.match].team1 = winnerName
        if (next.slot === 2) rounds[next.round][next.match].team2 = winnerName
      }

      if (roundId === 'semifinals-left' && rounds['third-place'][0]) {
        rounds['third-place'][0].team1 = loserName
      }
      if (roundId === 'semifinals-right' && rounds['third-place'][0]) {
        rounds['third-place'][0].team2 = loserName
      }
    })
  })

  const renderMatch = (match, roundId, index) => {
    const t1Class = match.winner === 1 ? 'ko-v-team winner-pick' : 'ko-v-team'
    const t2Class = match.winner === 2 ? 'ko-v-team winner-pick' : 'ko-v-team'
    const showScore = match.hasScore
    const scoring = match.scoring
    let scoringClass = ''
    if (scoring) {
      if (scoring.points >= 3) scoringClass = 'is-perfect'
      else if (scoring.points > 0) scoringClass = 'is-partial'
      else scoringClass = 'is-miss'
    }

    return `
      <div class="ko-v-match ${scoringClass}" data-round="${roundId}" data-index="${index}">
        <div class="ko-v-row ${match.winner === 1 ? 'is-winner' : ''}">
          <span class="${t1Class}" title="${match.team1}">${match.team1}</span>
          ${showScore ? `<span class="ko-v-score">${match.score1}</span>` : ''}
        </div>
        <div class="ko-v-row ${match.winner === 2 ? 'is-winner' : ''}">
          <span class="${t2Class}" title="${match.team2}">${match.team2}</span>
          ${showScore ? `<span class="ko-v-score">${match.score2}</span>` : ''}
        </div>
        ${
          scoring
            ? `<div class="ko-v-judge">
                <span class="ko-v-pill ${
                  !scoring.winnerPicked
                    ? 'neutral'
                    : scoring.winnerCorrect
                      ? 'ok'
                      : 'bad'
                }">Winner ${
                  !scoring.winnerPicked
                    ? 'No pick'
                    : scoring.winnerCorrect
                      ? 'Right'
                      : 'Wrong'
                }</span>
                <span class="ko-v-pill ${
                  !scoring.score1Picked
                    ? 'neutral'
                    : scoring.score1Correct
                      ? 'ok'
                      : 'bad'
                }">S1 ${
                  !scoring.score1Picked
                    ? 'No pick'
                    : scoring.score1Correct
                      ? 'Right'
                      : 'Wrong'
                }</span>
                <span class="ko-v-pill ${
                  !scoring.score2Picked
                    ? 'neutral'
                    : scoring.score2Correct
                      ? 'ok'
                      : 'bad'
                }">S2 ${
                  !scoring.score2Picked
                    ? 'No pick'
                    : scoring.score2Correct
                      ? 'Right'
                      : 'Wrong'
                }</span>
                <span class="ko-v-pill points">+${scoring.points} pts</span>
              </div>`
            : '<div class="ko-v-judge empty">No result yet</div>'
        }
      </div>
    `
  }

  const renderRoundColumn = (roundId, title) => `
    <div class="ko-v-round">
      <h4 class="ko-v-round-title">${title}</h4>
      ${rounds[roundId].map((m, i) => renderMatch(m, roundId, i)).join('')}
    </div>
  `

  const picksCount = Object.keys(predictions || {}).length
  bracketModalBody.innerHTML = `
    <div class="ko-v-summary">
      <span class="pick-right">Saved picks: ${picksCount}</span>
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
        ${renderRoundColumn('third-place', 'Play-off for third place')}
      </div>

      <div class="ko-v-side ko-v-right">
        ${renderRoundColumn('semifinals-right', 'Semifinals')}
        ${renderRoundColumn('quarterfinals-right', 'Quarterfinals')}
        ${renderRoundColumn('round16-right', 'Round of 16')}
        ${renderRoundColumn('round32-right', 'Round of 32')}
      </div>
    </div>
  `
}

const openBracketModal = async (userId, displayName) => {
  bracketModalTitle.textContent = `${displayName}'s Bracket`
  bracketModalBody.innerHTML =
    '<p style="padding:8px 0;color:#888">Loading…</p>'
  bracketModal.style.display = ''
  bracketModalBackdrop.style.display = ''
  document.body.classList.add('leaderboard-modal-open')

  try {
    const [predictionsSnapshot, resultsSnapshot] = await Promise.all([
      get(ref(db, `knockout_predictions/${userId}`)),
      get(ref(db, 'matchResults'))
    ])
    const predictions = predictionsSnapshot.exists()
      ? predictionsSnapshot.val()
      : {}
    const resultsByMatch = resultsSnapshot.exists() ? resultsSnapshot.val() : {}

    renderBracketModal(predictions, resultsByMatch)
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
        }" data-name="${formatUser(entry)}" style="cursor:pointer" title="Click to view bracket">
          <div class="place">#${index + 1}</div>
          <div class="player">
            <span class="player-name">${formatUser(entry)}</span>
            <div class="pick-balance">
              <span class="pick-right">Right team: ${entry.winnerPoints}</span>
              <span class="pick-right">Right score: ${entry.scorePoints}</span>
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
      openBracketModal(row.dataset.uid, row.dataset.name)
    })
  })
}

bracketModalClose?.addEventListener('click', closeBracketModal)
bracketModalBackdrop?.addEventListener('click', closeBracketModal)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBracketModal()
})

const run = async () => {
  try {
    const rows = await getKnockoutToplist()
    notice.style.display = 'none'
    renderLeaderboard(rows)
  } catch (error) {
    notice.style.display = 'block'
    notice.textContent = error.message || 'Could not load knockout top list.'
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
  if (userEmail) {
    userEmail.textContent = profile.nickname || user.email || 'User'
  }
  run()
})
