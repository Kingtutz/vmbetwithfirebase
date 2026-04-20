import {
  getAllGroupTeams,
  getBetLocks,
  getTournamentWinnerBet,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setTournamentWinnerBet,
  setUserNickname,
  updateUserEmail,
  updateUserPassword
} from './firebase.js'
import { initI18n, onLanguageChange, t, translateTeamName } from './i18n.js'

const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const teamsGrid = document.getElementById('teamsGrid')
const currentPick = document.getElementById('currentPick')
const statusMessage = document.getElementById('statusMessage')
const saveWinnerBtn = document.getElementById('saveWinnerBtn')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')

let currentUser = null
let allTeams = []
let savedWinner = ''
let selectedWinner = ''
let isSaving = false
let betLocks = { matchesLockedAt: '', winnerLockedAt: '' }

initI18n()

if (adminNavLink) {
  adminNavLink.style.display = 'none'
}

const setStatus = (type, message) => {
  statusMessage.style.display = message ? 'block' : 'none'
  statusMessage.className = `status-message ${type}`
  statusMessage.textContent = message || ''
}

const updateSaveButton = () => {
  if (!saveWinnerBtn) return

  const winnerLocked = isWinnerBetLockedByAdmin()

  const disabled =
    isSaving ||
    winnerLocked ||
    !selectedWinner ||
    selectedWinner === savedWinner ||
    !currentUser

  saveWinnerBtn.disabled = disabled
  saveWinnerBtn.textContent = isSaving
    ? t('winner.saving')
    : t('winner.savePick')
}

const isWinnerBetLockedByAdmin = () => {
  const lockAt = String(betLocks.winnerLockedAt || '')
  if (!lockAt) return false

  const lockTime = new Date(lockAt).getTime()
  if (Number.isNaN(lockTime)) return false
  return Date.now() >= lockTime
}

const updateCurrentPick = () => {
  if (!currentPick) return

  if (!savedWinner) {
    currentPick.textContent = t('winner.noPickYet')
    return
  }

  currentPick.textContent = t('winner.currentPick', {
    team: translateTeamName(savedWinner)
  })
}

const renderTeams = () => {
  if (!teamsGrid) return

  teamsGrid.innerHTML = allTeams
    .map(team => {
      const selectedClass = selectedWinner === team ? ' selected' : ''
      const savedClass = savedWinner === team ? ' saved' : ''
      return `
        <button
          type="button"
          class="team-option${selectedClass}${savedClass}"
          data-team="${team}"
          ${isWinnerBetLockedByAdmin() ? 'disabled' : ''}
        >
          ${translateTeamName(team)}
        </button>
      `
    })
    .join('')

  teamsGrid.querySelectorAll('.team-option').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedWinner = btn.dataset.team || ''
      setStatus('', '')
      renderTeams()
      updateSaveButton()
    })
  })
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
      setTimeout(closeModal, 1500)
    } catch (error) {
      console.error('Account update failed:', error)
      showMessage(error.message || t('account.updateError'), 'error')
    }
  }
}

const run = async () => {
  try {
    const [groups, winnerBet, locks] = await Promise.all([
      getAllGroupTeams(),
      getTournamentWinnerBet(currentUser.uid),
      getBetLocks()
    ])

    betLocks = locks || { matchesLockedAt: '', winnerLockedAt: '' }

    allTeams = [...new Set(groups.flatMap(group => group.teams || []))].sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
    )

    savedWinner = winnerBet?.winnerTeam || ''
    selectedWinner = savedWinner || selectedWinner

    setStatus('', '')
    if (isWinnerBetLockedByAdmin()) {
      setStatus('error', t('winner.lockedByAdmin'))
    }
    renderTeams()
    updateCurrentPick()
    updateSaveButton()
  } catch (error) {
    setStatus('error', error.message || t('winner.couldNotLoad'))
  }
}

saveWinnerBtn.addEventListener('click', async () => {
  if (!currentUser || !selectedWinner || selectedWinner === savedWinner) return

  if (isWinnerBetLockedByAdmin()) {
    setStatus('error', t('winner.lockedByAdmin'))
    return
  }

  try {
    isSaving = true
    updateSaveButton()
    await setTournamentWinnerBet(currentUser.uid, selectedWinner)
    savedWinner = selectedWinner
    updateCurrentPick()
    setStatus('success', t('winner.saveSuccess'))
    renderTeams()
  } catch (error) {
    setStatus('error', error.message || t('winner.saveFailed'))
  } finally {
    isSaving = false
    updateSaveButton()
  }
})

logoutBtn.addEventListener('click', async () => {
  try {
    await logOut()
    window.location.href = 'login.html'
  } catch (error) {
    setStatus('error', error.message || t('common.logoutFailed'))
  }
})

onAuthChange(async user => {
  if (!user) {
    window.location.href = 'login.html'
    return
  }

  currentUser = user
  const profile = await getUserProfile(user.uid)
  userEmail.textContent = profile.nickname || user.email || t('common.user')
  logoutBtn.textContent = t('common.logout')
  attachAccountSettingsModal(profile)

  const admin = await isAdminUser(user)
  if (adminNavLink) {
    adminNavLink.style.display = admin ? '' : 'none'
  }

  await run()
})

onLanguageChange(() => {
  logoutBtn.textContent = t('common.logout')
  userEmail.title = t('nickname.clickToChange')
  updateCurrentPick()
  updateSaveButton()
  renderTeams()
})
