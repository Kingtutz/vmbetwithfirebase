import {
  getAllUsers,
  getLeaderboard,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setUserNickname
} from './firebase.js'

const leaderboardContainer = document.getElementById('leaderboard')
const payoutBreakdown = document.getElementById('payoutBreakdown')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const notice = document.getElementById('notice')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
const matchesNavLink = document.querySelector(
  '.nav-buttons a[href="bets.html"]'
)
let currentUser = null

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

if (matchesNavLink) {
  matchesNavLink.style.display = 'none'
}

const updateAdminTabVisibility = async user => {
  if (!adminNavLink) return

  const admin = await isAdminUser(user)
  adminNavLink.style.display = admin ? '' : 'none'
}

const updateMatchesTabVisibility = user => {
  if (!matchesNavLink) return
  matchesNavLink.style.display = user ? '' : 'none'
}

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
      run()
    } catch (error) {
      console.error('Nickname update failed:', error)
      window.alert(error.message || 'Could not update nickname.')
    }
  }
}

const formatUser = entry => {
  if (entry.nickname) return entry.nickname
  if (entry.email) return entry.email
  const shortId = String(entry.userId || '').slice(0, 8)
  return `User ${shortId}`
}

const renderLeaderboard = rows => {
  if (!rows.length) {
    leaderboardContainer.innerHTML = '<p>No predictions yet.</p>'
    return
  }

  const listHtml = rows
    .map((entry, index) => {
      return `
        <div class="leaderboard-row">
          <div class="place">#${index + 1}</div>
          <div class="player">${formatUser(entry)}</div>
          <div class="stats">
            <span class="points">${entry.points} pts</span>
            <span class="meta">${entry.predictionsCount} predictions</span>
            <span class="meta">${entry.resolvedMatchesCount} scored</span>
          </div>
        </div>
      `
    })
    .join('')

  leaderboardContainer.innerHTML = listHtml
}

const run = async () => {
  try {
    const [rows, users] = await Promise.all([getLeaderboard(), getAllUsers()])
    const paidUsers = users.filter(user => user.hasPaid)
    const totalPool = paidUsers.length * 100
    const firstPrize = Math.round(totalPool * 0.65)
    const secondPrize = Math.round(totalPool * 0.15)
    const thirdPrize = Math.round(totalPool * 0.1)

    if (payoutBreakdown) {
      payoutBreakdown.innerHTML = `
        <span class="payout-chip">1st: ${firstPrize} kr</span>
        <span class="payout-chip">2nd: ${secondPrize} kr</span>
        <span class="payout-chip">3rd: ${thirdPrize} kr</span>
      `
    }

    notice.style.display = 'none'
    renderLeaderboard(rows)
  } catch (error) {
    notice.style.display = 'block'
    notice.textContent = error.message || 'Could not load leaderboard.'
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
    updateMatchesTabVisibility(null)
    userEmail.textContent = 'Guest'
    userEmail.style.cursor = 'default'
    userEmail.title = 'Log in to set a nickname'
    userEmail.onclick = null
    logoutBtn.style.display = ''
    logoutBtn.textContent = 'Login'
    run()
    return
  }

  logoutBtn.style.display = ''
  logoutBtn.textContent = 'Logout'
  updateMatchesTabVisibility(user)
  await updateAdminTabVisibility(user)
  const profile = await getUserProfile(user.uid)
  userEmail.textContent = profile.nickname || user.email || 'User'
  attachNicknameEditor(profile.nickname || '')
  run()
})
