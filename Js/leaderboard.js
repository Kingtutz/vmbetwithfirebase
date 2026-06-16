import {
  getAllMatchesFlat,
  getAllUsers,
  getLeaderboard,
  getUserPredictions,
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
let leaderboardRows = []
let allMatches = []
const picksStateByUser = {}
let picksModal = null
let picksModalBackdrop = null
let picksModalTitle = null
let picksModalBody = null
let picksModalCloseBtn = null
let currentPicksUserId = ''
let currentUserPredictionMap = {}

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

const getPredictionLabel = (match, prediction) => {
  if (!match) return t('common.notSet')
  if (prediction === 'team1') return translateTeamName(match.team1)
  if (prediction === 'team2') return translateTeamName(match.team2)
  if (prediction === 'draw') return t('common.draw')
  return t('common.notSet')
}

const isValidPrediction = value => ['team1', 'team2', 'draw'].includes(value)

const toPredictionMap = predictionRows => {
  const map = {}
  ;(predictionRows || []).forEach(row => {
    const matchId = String(row?.matchId || '')
    const prediction = String(row?.prediction || '')
    if (!matchId || !isValidPrediction(prediction)) return
    map[matchId] = prediction
  })
  return map
}

const ensurePicksModal = () => {
  if (picksModal && picksModalBackdrop) return

  picksModalBackdrop = document.createElement('div')
  picksModalBackdrop.className = 'leaderboard-picks-backdrop'
  picksModalBackdrop.style.display = 'none'

  picksModal = document.createElement('section')
  picksModal.className = 'leaderboard-picks-modal'
  picksModal.style.display = 'none'
  picksModal.setAttribute('role', 'dialog')
  picksModal.setAttribute('aria-modal', 'true')

  picksModal.innerHTML = `
    <div class="leaderboard-picks-modal-header">
      <h3 class="leaderboard-picks-modal-title"></h3>
      <button type="button" class="leaderboard-picks-close-btn" aria-label="Close">×</button>
    </div>
    <div class="leaderboard-picks-modal-body"></div>
  `

  document.body.appendChild(picksModalBackdrop)
  document.body.appendChild(picksModal)

  picksModalTitle = picksModal.querySelector('.leaderboard-picks-modal-title')
  picksModalBody = picksModal.querySelector('.leaderboard-picks-modal-body')
  picksModalCloseBtn = picksModal.querySelector('.leaderboard-picks-close-btn')

  picksModalBackdrop.addEventListener('click', () => {
    closePicksModal()
  })

  picksModalCloseBtn?.addEventListener('click', () => {
    closePicksModal()
  })
}

const closePicksModal = () => {
  if (!picksModal || !picksModalBackdrop) return
  picksModal.style.display = 'none'
  picksModalBackdrop.style.display = 'none'
  document.body.classList.remove('leaderboard-modal-open')
  currentPicksUserId = ''
}

const renderPicksListHtml = picks => {
  const orderByMatchId = new Map(
    allMatches.map((match, index) => [String(match.id), index])
  )
  const matchById = new Map(allMatches.map(match => [String(match.id), match]))

  const sortedPicks = (picks || []).slice().sort((a, b) => {
    const aIdx = orderByMatchId.get(String(a.matchId))
    const bIdx = orderByMatchId.get(String(b.matchId))
    if (aIdx == null && bIdx == null) {
      return String(a.matchId).localeCompare(String(b.matchId))
    }
    if (aIdx == null) return 1
    if (bIdx == null) return -1
    return aIdx - bIdx
  })

  if (!sortedPicks.length) {
    return `<div class="player-picks-empty">${t(
      'leaderboard.noPicksForPlayer'
    )}</div>`
  }

  const picksHtml = sortedPicks
    .map(pick => {
      const match = matchById.get(String(pick.matchId))
      const myPrediction = currentUserPredictionMap[String(pick.matchId)]
      const hasComparison = isValidPrediction(myPrediction)
      const samePick = hasComparison && myPrediction === pick.prediction
      const matchLabel = match
        ? `${translateTeamName(match.team1)} vs ${translateTeamName(match.team2)}`
        : `${t('common.matches')} #${pick.matchId}`
      const roundLabel = match?.round
        ? `<span class="player-pick-round">${match.round}</span>`
        : ''
      const compareHtml = hasComparison
        ? `
          <div class="player-pick-compare">
            <span class="player-pick-your-choice">${t(
              'leaderboard.yourPickLabel',
              {
                pick: getPredictionLabel(match, myPrediction)
              }
            )}</span>
            <span class="player-pick-compare-badge ${
              samePick ? 'same' : 'different'
            }">${
            samePick
              ? t('leaderboard.samePick')
              : t('leaderboard.differentPick')
          }</span>
          </div>
        `
        : ''

      return `
        <div class="player-pick-item">
          <div class="player-pick-main">
            <div class="player-pick-match">
              <span>${matchLabel}</span>
              ${roundLabel}
            </div>
            ${compareHtml}
          </div>
          <div class="player-pick-choice">${t('leaderboard.pickLabel', {
            pick: getPredictionLabel(match, pick.prediction)
          })}</div>
        </div>
      `
    })
    .join('')

  return `<div class="player-picks-list">${picksHtml}</div>`
}

const renderPicksModalForUser = userId => {
  if (!userId || !picksModalTitle || !picksModalBody) return

  const entry = leaderboardRows.find(row => row.userId === userId)
  if (!entry) {
    picksModalBody.innerHTML = `<div class="player-picks-empty">${t(
      'leaderboard.couldNotLoadPicks'
    )}</div>`
    return
  }

  picksModalTitle.textContent = t('leaderboard.picksFor', {
    user: formatUser(entry)
  })

  const state = picksStateByUser[userId] || { status: 'idle', picks: [] }
  if (state.status === 'loading' || state.status === 'idle') {
    picksModalBody.innerHTML = `<div class="player-picks-empty">${t(
      'leaderboard.loadingPicks'
    )}</div>`
    return
  }

  if (state.status === 'error') {
    picksModalBody.innerHTML = `<div class="player-picks-empty">${t(
      'leaderboard.couldNotLoadPicks'
    )}</div>`
    return
  }

  picksModalBody.innerHTML = renderPicksListHtml(state.picks)
}

const openPicksModal = userId => {
  const previousUserId = currentPicksUserId
  ensurePicksModal()
  currentPicksUserId = userId

  if (previousUserId && previousUserId !== userId && picksModal) {
    picksModal.scrollTop = 0
  }

  renderPicksModalForUser(userId)

  if (!picksModal || !picksModalBackdrop) return
  picksModal.style.display = 'block'
  picksModalBackdrop.style.display = 'block'
  document.body.classList.add('leaderboard-modal-open')
}

const loadUserPicks = async userId => {
  picksStateByUser[userId] = { status: 'loading', picks: [] }
  if (currentPicksUserId === userId) {
    renderPicksModalForUser(userId)
  }

  try {
    const picks = await getUserPredictions(userId)
    picksStateByUser[userId] = {
      status: 'ready',
      picks: Array.isArray(picks) ? picks : []
    }
  } catch (error) {
    picksStateByUser[userId] = { status: 'error', picks: [] }
  }

  if (currentPicksUserId === userId) {
    renderPicksModalForUser(userId)
  }
}

const attachPlayerRowHandlers = () => {
  leaderboardContainer.querySelectorAll('.player-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = String(btn.dataset.userId || '')
      if (!userId) return

      openPicksModal(userId)

      const state = picksStateByUser[userId]
      if (!state || state.status === 'idle' || state.status === 'error') {
        await loadUserPicks(userId)
      }
    })
  })
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
            <button
              type="button"
              class="player-toggle-btn"
              data-user-id="${entry.userId}"
              aria-haspopup="dialog"
            >
              <span class="player-name">${formatUser(entry)}</span>
              <span class="player-toggle-hint">${t(
                'leaderboard.showPicks'
              )}</span>
            </button>
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
  attachPlayerRowHandlers()
}

const run = async () => {
  try {
    const ownPredictionsPromise = currentUser
      ? getUserPredictions(currentUser.uid).catch(() => [])
      : Promise.resolve([])

    const [rows, users, matches, ownPredictions] = await Promise.all([
      getLeaderboard(),
      getAllUsers(),
      getAllMatchesFlat(),
      ownPredictionsPromise
    ])
    leaderboardRows = rows || []
    allMatches = Array.isArray(matches) ? matches : []
    currentUserPredictionMap = toPredictionMap(ownPredictions)
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
    renderLeaderboard(leaderboardRows)
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

  if (currentPicksUserId) {
    renderPicksModalForUser(currentPicksUserId)
  }

  run()
})
