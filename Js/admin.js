import {
  getAllMatchesFlat,
  getAllMatchResults,
  getAllUsers,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setUserNickname,
  setMatchWinner,
  setUserPaid
} from './firebase.js'

const matchesContainer = document.getElementById('matches')
const roundFilter = document.getElementById('roundFilter')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNotice = document.getElementById('adminNotice')
const usersList = document.getElementById('usersList')
const usersNotice = document.getElementById('usersNotice')

let currentUser = null
let allMatches = []
let allResults = {}
let allUsers = []
let isSaving = false
let isTogglingPaid = false

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

const winnerLabel = (winner, match) => {
  if (winner === 'team1') return match.team1
  if (winner === 'team2') return match.team2
  if (winner === 'draw') return 'Draw'
  return 'Not set'
}

const renderMatchCard = match => {
  const result = allResults[match.id]
  const winner = result?.winner

  return `
    <article class="match-card">
      <div class="match-header">
        <div>${match.date ?? ''} ${match.time ?? ''}</div>
        <div>${match.round ?? ''}</div>
      </div>
      <div class="match-content">
        <div class="teams">
          <span class="team-name">${match.team1}</span>
          <span class="vs">VS</span>
          <span class="team-name">${match.team2}</span>
        </div>
        <div class="winner-buttons">
          <button class="winner-btn ${
            winner === 'team1' ? 'active' : ''
          }" data-match-id="${match.id}" data-winner="team1" ${
    isSaving ? 'disabled' : ''
  }>
            ${match.team1}
          </button>
          <button class="winner-btn ${
            winner === 'draw' ? 'active' : ''
          }" data-match-id="${match.id}" data-winner="draw" ${
    isSaving ? 'disabled' : ''
  }>
            Draw
          </button>
          <button class="winner-btn ${
            winner === 'team2' ? 'active' : ''
          }" data-match-id="${match.id}" data-winner="team2" ${
    isSaving ? 'disabled' : ''
  }>
            ${match.team2}
          </button>
        </div>
        <div class="current-winner">Current winner: ${winnerLabel(
          winner,
          match
        )}</div>
      </div>
    </article>
  `
}

const attachWinnerHandlers = () => {
  document.querySelectorAll('.winner-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matchId = btn.dataset.matchId
      const winner = btn.dataset.winner
      if (!matchId || !winner || isSaving) return

      try {
        isSaving = true
        renderMatches(getFilteredMatches())
        const payload = await setMatchWinner(currentUser, matchId, winner)
        allResults[matchId] = payload
        adminNotice.style.display = 'none'
      } catch (error) {
        adminNotice.style.display = 'block'
        adminNotice.textContent =
          error.message || 'Could not save match winner.'
      } finally {
        isSaving = false
        renderMatches(getFilteredMatches())
      }
    })
  })
}

const getFilteredMatches = () => {
  const query = roundFilter.value.trim().toLowerCase()
  if (!query) return allMatches

  return allMatches.filter(match =>
    String(match.round || '')
      .toLowerCase()
      .includes(query)
  )
}

const renderMatches = matches => {
  if (!matches.length) {
    matchesContainer.innerHTML = '<p>No matches found.</p>'
    return
  }

  matchesContainer.innerHTML = matches.map(renderMatchCard).join('')
  attachWinnerHandlers()
}

const renderUsers = () => {
  if (!allUsers.length) {
    usersList.innerHTML =
      '<p class="users-empty">No registered users found.</p>'
    return
  }

  const rows = allUsers
    .slice()
    .sort((a, b) =>
      (a.nickname || a.email || a.uid).localeCompare(
        b.nickname || b.email || b.uid
      )
    )
    .map(
      u => `
      <div class="user-row">
        <div class="user-identity">
          <span class="user-name">${u.nickname || u.email || u.uid}</span>
          ${
            u.nickname && u.email
              ? `<span class="user-email">${u.email}</span>`
              : ''
          }
        </div>
        <span class="paid-badge ${u.hasPaid ? 'paid' : 'unpaid'}">
          ${u.hasPaid ? 'Paid' : 'Unpaid'}
        </span>
        <button
          class="toggle-paid-btn"
          data-uid="${u.uid}"
          data-paid="${u.hasPaid}"
          ${isTogglingPaid ? 'disabled' : ''}>
          ${u.hasPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
        </button>
      </div>`
    )
    .join('')

  usersList.innerHTML = rows
  attachPaymentHandlers()
}

const attachPaymentHandlers = () => {
  usersList.querySelectorAll('.toggle-paid-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid
      const currentPaid = btn.dataset.paid === 'true'
      if (!uid || isTogglingPaid) return

      try {
        isTogglingPaid = true
        renderUsers()
        await setUserPaid(uid, !currentPaid)
        const user = allUsers.find(u => u.uid === uid)
        if (user) user.hasPaid = !currentPaid
        usersNotice.style.display = 'none'
      } catch (error) {
        usersNotice.style.display = 'block'
        usersNotice.textContent =
          error.message || 'Could not update payment status.'
      } finally {
        isTogglingPaid = false
        renderUsers()
      }
    })
  })
}

const loadPage = async () => {
  const admin = await isAdminUser(currentUser)
  if (!admin) {
    adminNotice.style.display = 'block'
    adminNotice.textContent =
      'You are logged in, but this account is not an admin.'
    matchesContainer.innerHTML = ''
    usersList.innerHTML = ''
    return
  }

  const [matches, results, users] = await Promise.all([
    getAllMatchesFlat(),
    getAllMatchResults(),
    getAllUsers()
  ])

  allMatches = matches
  allResults = results || {}
  allUsers = users || []
  adminNotice.style.display = 'none'
  renderMatches(getFilteredMatches())
  renderUsers()
}

roundFilter.addEventListener('input', () => {
  renderMatches(getFilteredMatches())
})

logoutBtn.addEventListener('click', async () => {
  try {
    await logOut()
    window.location.href = 'login.html'
  } catch (error) {
    adminNotice.style.display = 'block'
    adminNotice.textContent = error.message || 'Logout failed.'
  }
})

onAuthChange(async user => {
  if (!user) {
    window.location.href = 'login.html'
    return
  }

  currentUser = user
  const profile = await getUserProfile(user.uid)
  userEmail.textContent = profile.nickname || user.email || 'User'
  attachNicknameEditor(profile.nickname || '')

  try {
    await loadPage()
  } catch (error) {
    adminNotice.style.display = 'block'
    adminNotice.textContent = error.message || 'Could not load admin page.'
  }
})
