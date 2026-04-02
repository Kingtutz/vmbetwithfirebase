import {
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange
} from './firebase.js'
import { initI18n, onLanguageChange, t } from './i18n.js'

initI18n()

const loginCta = document.querySelector('.cta-row a[href="login.html"]')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
const matchesNavLink = document.querySelector(
  '.nav-buttons a[href="bets.html"]'
)
const winnerNavLink = document.querySelector(
  '.nav-buttons a[href="winner.html"]'
)

let currentUser = null

const updateMatchesTabVisibility = user => {
  if (!matchesNavLink) return
  matchesNavLink.style.display = user ? '' : 'none'
}

const updateWinnerTabVisibility = user => {
  if (!winnerNavLink) return
  winnerNavLink.style.display = user ? '' : 'none'
}

const updateAdminTabVisibility = async user => {
  if (!adminNavLink) return
  const admin = await isAdminUser(user)
  adminNavLink.style.display = admin ? '' : 'none'
}

logoutBtn?.addEventListener('click', async () => {
  if (!currentUser) {
    window.location.href = 'login.html'
    return
  }

  try {
    await logOut()
  } catch (error) {
    console.error('Logout failed:', error)
    window.alert(t('common.logoutFailed'))
  }
})

onAuthChange(async user => {
  currentUser = user || null

  if (loginCta) {
    loginCta.style.display = user ? 'none' : ''
  }

  if (!user) {
    updateMatchesTabVisibility(null)
    updateWinnerTabVisibility(null)
    await updateAdminTabVisibility(null)
    if (userEmail) userEmail.textContent = t('common.guest')
    if (logoutBtn) logoutBtn.textContent = t('common.login')
    return
  }

  updateMatchesTabVisibility(user)
  updateWinnerTabVisibility(user)
  await updateAdminTabVisibility(user)

  const profile = await getUserProfile(user.uid)
  if (userEmail) {
    userEmail.textContent = profile.nickname || user.email || t('common.user')
  }
  if (logoutBtn) logoutBtn.textContent = t('common.logout')
})

onLanguageChange(() => {
  if (!userEmail || !logoutBtn) return

  if (!currentUser) {
    userEmail.textContent = t('common.guest')
    logoutBtn.textContent = t('common.login')
  } else {
    logoutBtn.textContent = t('common.logout')
  }
})
