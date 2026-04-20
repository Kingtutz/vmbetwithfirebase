import {
  getAllUsers,
  getLeaderboard,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setUserNickname,
  updateUserEmail,
  updateUserPassword
} from './firebase.js'
import { initI18n, onLanguageChange, t, translateTeamName } from './i18n.js'

const leaderboardContainer = document.getElementById('leaderboard')
const payoutBreakdown = document.getElementById('payoutBreakdown')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const notice = document.getElementById('notice')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
const matchesNavLink = document.querySelector(
  '.nav-buttons a[href="bets.html"]'
)
const winnerNavLink = document.querySelector(
  '.nav-buttons a[href="winner.html"]'
)
let currentUser = null

initI18n()

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

if (matchesNavLink) {
  matchesNavLink.style.display = 'none'
}

if (winnerNavLink) {
  winnerNavLink.style.display = 'none'
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

const updateWinnerTabVisibility = user => {
  if (!winnerNavLink) return
  winnerNavLink.style.display = user ? '' : 'none'
}

const attachAccountSettingsModal = async profile => {
  const modal = document.getElementById('accountSettingsModal')
  const backdrop = document.getElementById('accountModalBackdrop')
  const form = document.getElementById('accountForm')
  const closeButtons = document.querySelectorAll('.account-modal-close')
  const messageDiv = document.getElementById('accountMessage')
  const nicknameInput = document.getElementById('accountNickname')
  const emailInput = document.getElementById('accountEmail')
  const passwordInput = document.getElementById('accountPassword')

  if (!modal || !form) return

  const showMessage = (text, type = 'success') => {
    messageDiv.textContent = text
    messageDiv.className = `account-message ${type}`
    messageDiv.style.display = 'block'
  }

  const hideMessage = () => {
    messageDiv.style.display = 'none'
  }

  const closeModal = () => {
    modal.style.display = 'none'
    backdrop.style.display = 'none'
    hideMessage()
  }

  const openModal = async () => {
    if (!currentUser) return

    const userProfile = await getUserProfile(currentUser.uid)
    nicknameInput.value = userProfile?.nickname || ''
    emailInput.value = currentUser.email || ''
    passwordInput.value = ''

    modal.style.display = 'block'
    backdrop.style.display = 'block'
    hideMessage()
  }

  userEmail.style.cursor = 'pointer'
  userEmail.title = t('nickname.clickToChange')
  userEmail.onclick = openModal

  closeButtons.forEach(btn => {
    btn.onclick = closeModal
  })

  backdrop.onclick = closeModal

  form.onsubmit = async e => {
    e.preventDefault()

    if (!currentUser) {
      showMessage(t('common.logoutFailed'), 'error')
      return
    }

    const nickname = nicknameInput.value.trim()
    const email = emailInput.value.trim()
    const password = passwordInput.value.trim()

    if (!nickname) {
      showMessage(t('nickname.empty'), 'error')
      return
    }

    try {
      let errorOccurred = false

      // Update nickname
      try {
        await setUserNickname(currentUser.uid, nickname)
      } catch (err) {
        console.error('Nickname update failed:', err)
        errorOccurred = true
      }

      // Update email if changed
      if (email && email !== currentUser.email) {
        try {
          await updateUserEmail(currentUser, email)
        } catch (err) {
          console.error('Email update failed:', err)
          showMessage(err.message || t('account.updateError'), 'error')
          return
        }
      }

      // Update password if provided
      if (password) {
        try {
          await updateUserPassword(currentUser, password)
        } catch (err) {
          console.error('Password update failed:', err)
          showMessage(err.message || t('account.updateError'), 'error')
          return
        }
      }

      showMessage(t('account.updateSuccess'), 'success')
      userEmail.textContent = nickname
      setTimeout(() => {
        closeModal()
        run()
      }, 1500)
    } catch (error) {
      console.error('Account update failed:', error)
      showMessage(error.message || t('account.updateError'), 'error')
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
          <div class="player">
            <div class="player-name">${formatUser(entry)}</div>
            ${
              entry.winnerTeam
                ? `<div class="winner-pick">${t('leaderboard.winnerPick', {
                    team: translateTeamName(entry.winnerTeam)
                  })}</div>`
                : ''
            }
          </div>
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
    notice.textContent = error.message || t('common.logoutFailed')
  }
})

onAuthChange(async user => {
  currentUser = user || null

  if (!user) {
    await updateAdminTabVisibility(null)
    updateMatchesTabVisibility(null)
    updateWinnerTabVisibility(null)
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
  updateWinnerTabVisibility(user)
  await updateAdminTabVisibility(user)
  const profile = await getUserProfile(user.uid)
  userEmail.textContent = profile.nickname || user.email || t('common.user')
  attachAccountSettingsModal(profile)
  run()
})

onLanguageChange(() => {
  if (!currentUser) {
    userEmail.textContent = t('common.guest')
    userEmail.title = t('nickname.loginToSet')
    logoutBtn.textContent = t('common.login')
  } else {
    logoutBtn.textContent = t('common.logout')
    userEmail.title = t('nickname.clickToChange')
  }
  run()
})
