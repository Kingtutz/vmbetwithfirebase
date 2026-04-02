import {
  getAllGroupTeams,
  getBetLocks,
  getTournamentWinnerBet,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setTournamentWinnerBet,
  setUserNickname
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
    } catch (error) {
      window.alert(error.message || t('nickname.updateFailed'))
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
  attachNicknameEditor(profile.nickname || '')

  const admin = await isAdminUser(user)
  if (adminNavLink) {
    adminNavLink.style.display = admin ? '' : 'none'
  }

  await run()
})

onLanguageChange(() => {
  logoutBtn.textContent = t('common.logout')
  updateCurrentPick()
  updateSaveButton()
  renderTeams()
})
