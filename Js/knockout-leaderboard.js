import {
  getKnockoutLeaderboard,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange
} from './firebase.js'

const leaderboardContainer = document.getElementById('leaderboard')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const notice = document.getElementById('notice')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
let currentUser = null

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
        <div class="leaderboard-row">
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
