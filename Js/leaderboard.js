import {
  getAllUsers,
  getLeaderboard,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setUserNickname
} from './firebase.js'
import { initI18n, onLanguageChange, t } from './i18n.js'

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

initI18n()

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
  userEmail.title = t('nickname.clickToChange')

  userEmail.onclick = async () => {
    if (!currentUser) return

    const nextNickname = window.prompt(
      t('nickname.prompt'),
      currentNickname || userEmail.textContent || ''
    )

    if (nextNickname == null) return

    const cleanNickname = nextNickname.trim()
    if (!cleanNickname) {
      window.alert(t('nickname.empty'))
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
      window.alert(error.message || t('nickname.updateFailed'))
    }
  }
}

const formatUser = entry => {
  if (entry.nickname) return entry.nickname
  if (entry.email) return entry.email
  const shortId = String(entry.userId || '').slice(0, 8)
  return `${t('common.user')} ${shortId}`
}

const renderLeaderboard = rows => {
  if (!rows.length) {
    leaderboardContainer.innerHTML = `<p>${t(
      'leaderboard.noPredictionsYet'
    )}</p>`
    return
  }

  const listHtml = rows
    .map((entry, index) => {
      return `
        <div class="leaderboard-row">
          <div class="place">#${index + 1}</div>
          <div class="player">${formatUser(entry)}</div>
          <div class="stats">
            <span class="points">${entry.points} ${t(
        'common.pointsShort'
      )}</span>
            <span class="meta">${entry.predictionsCount} ${t(
        'common.predictionsLabel'
      )}</span>
            <span class="meta">${entry.resolvedMatchesCount} ${t(
        'common.scoredLabel'
      )}</span>
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
        <span class="payout-chip">${t('leaderboard.firstPrize', {
          amount: firstPrize
        })}</span>
        <span class="payout-chip">${t('leaderboard.secondPrize', {
          amount: secondPrize
        })}</span>
        <span class="payout-chip">${t('leaderboard.thirdPrize', {
          amount: thirdPrize
        })}</span>
      `
    }

    notice.style.display = 'none'
    renderLeaderboard(rows)
  } catch (error) {
    notice.style.display = 'block'
    notice.textContent = error.message || t('leaderboard.couldNotLoad')
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
    userEmail.textContent = t('common.guest')
    userEmail.style.cursor = 'default'
    userEmail.title = t('nickname.loginToSet')
    userEmail.onclick = null
    logoutBtn.style.display = ''
    logoutBtn.textContent = t('common.login')
    run()
    return
  }

  logoutBtn.style.display = ''
  logoutBtn.textContent = t('common.logout')
  updateMatchesTabVisibility(user)
  await updateAdminTabVisibility(user)
  const profile = await getUserProfile(user.uid)
  userEmail.textContent = profile.nickname || user.email || t('common.user')
  attachNicknameEditor(profile.nickname || '')
  run()
})

onLanguageChange(() => {
  if (!currentUser) {
    userEmail.textContent = t('common.guest')
    userEmail.title = t('nickname.loginToSet')
    logoutBtn.textContent = t('common.login')
  } else {
    logoutBtn.textContent = t('common.logout')
    attachNicknameEditor(userEmail.textContent)
  }
  run()
})
