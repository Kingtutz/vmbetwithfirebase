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

const openBracketModal = async (userId, displayName) => {
  bracketModalTitle.textContent = `${displayName}'s Bracket`
  bracketModalBody.innerHTML =
    '<p style="padding:8px 0;color:#888">Loading…</p>'
  bracketModal.style.display = ''
  bracketModalBackdrop.style.display = ''
  document.body.classList.add('leaderboard-modal-open')

  try {
    const snapshot = await get(ref(db, `knockout_predictions/${userId}`))
    const predictions = snapshot.exists() ? snapshot.val() : {}
    renderBracketModal(predictions)
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

const renderBracketModal = predictions => {
  // Group rounds that share the same label (left+right) for display
  const grouped = [
    { label: 'Round of 32', keys: ['round32-left', 'round32-right'] },
    { label: 'Round of 16', keys: ['round16-left', 'round16-right'] },
    {
      label: 'Quarterfinals',
      keys: ['quarterfinals-left', 'quarterfinals-right']
    },
    { label: 'Semifinals', keys: ['semifinals-left', 'semifinals-right'] },
    { label: 'Final', keys: ['final'] },
    { label: 'Play-off for third place', keys: ['thirdPlace'] }
  ]

  const html = grouped
    .map(group => {
      const matchRows = group.keys.flatMap(roundKey => {
        const matches = knockoutData[roundKey] || []
        return matches.map((match, idx) => {
          const matchPrefix =
            roundKey === 'thirdPlace' ? 'third-place' : roundKey
          const matchId = `${matchPrefix}_${idx}`
          const fallbackMatchId = `${roundKey}_${idx}`
          const pred =
            predictions[matchId] || predictions[fallbackMatchId] || {}
          const explicitWinner =
            Number.parseInt(String(pred.winner ?? ''), 10) || null
          const score1 = pred.score1 != null ? pred.score1 : 0
          const score2 = pred.score2 != null ? pred.score2 : 0
          const parsedScore1 = Number.parseInt(String(score1), 10)
          const parsedScore2 = Number.parseInt(String(score2), 10)
          const winnerFromScores =
            Number.isFinite(parsedScore1) &&
            Number.isFinite(parsedScore2) &&
            parsedScore1 !== parsedScore2
              ? parsedScore1 > parsedScore2
                ? 1
                : 2
              : null
          const winner = explicitWinner || winnerFromScores

          const t1Class =
            winner === 1 ? 'ko-bracket-team winner-pick' : 'ko-bracket-team'
          const t2Class =
            winner === 2 ? 'ko-bracket-team winner-pick' : 'ko-bracket-team'

          const scoreHtml =
            winner != null || pred.score1 != null || pred.score2 != null
              ? `<span class="ko-bracket-score">
               <span class="ko-bracket-score-val">${score1}</span>
               –
               <span class="ko-bracket-score-val">${score2}</span>
             </span>`
              : ''

          return `
          <div class="ko-bracket-match">
            <span class="${t1Class}" title="${match.team1}">${match.team1}</span>
            <span class="ko-bracket-vs">vs</span>
            <span class="${t2Class}" title="${match.team2}">${match.team2}</span>
            ${scoreHtml}
          </div>`
        })
      })

      const hasPick = matchRows.some(row => row.includes('winner-pick'))
      if (
        !hasPick &&
        matchRows.every(row => !row.includes('ko-bracket-score-val'))
      ) {
        // All empty - still show section but indicate no picks
      }

      return `
      <div class="ko-bracket-round-section">
        <h4 class="ko-bracket-round-title">${group.label}</h4>
        <div class="ko-bracket-match-list">${matchRows.join('')}</div>
      </div>`
    })
    .join('')

  bracketModalBody.innerHTML = `<div class="ko-bracket-rounds">${html}</div>`
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
      )}" style="cursor:pointer" title="Click to view bracket">
          <div class="place">#${index + 1}</div>
          <div class="player">
            <span class="player-name">${formatUser(entry)}</span>
            <div class="winner-pick">${entry.winnerPoints} winner points, ${
        entry.goalPoints
      } goal points</div>
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
