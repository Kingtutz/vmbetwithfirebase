import {
  getAllGroupTeams,
  getAllMatchResults,
  getAllMatchesFlat,
  getUserProfile,
  getUserPredictions,
  isAdminUser,
  onAuthChange,
  logOut,
  setUserNickname,
  updateUserEmail,
  updateUserPassword
} from './firebase.js'
import { initI18n, onLanguageChange, t, translateTeamName } from './i18n.js'

const groupsContainer = document.getElementById('groups')
const matchesPanel = document.getElementById('matchesPanel')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
const matchesNavLink = document.querySelector(
  '.nav-buttons a[href="bets.html"]'
)
const winnerNavLink = document.querySelector(
  '.nav-buttons a[href="winner.html"]'
)

let allGroups = []
let allMatches = []
let allResults = {}
let userPredictions = {}
let currentUser = null
let selectedTeam = null

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
      setTimeout(closeModal, 1500)
    } catch (error) {
      console.error('Account update failed:', error)
      showMessage(error.message || t('account.updateError'), 'error')
    }
  }
}

const renderDefaultMatchesPanel = () => {
  matchesPanel.innerHTML = `
    <h2 class="matches-title">${t('groups.upcomingMatches')}</h2>
    <p>${t('groups.selectTeam')}</p>
  `
}

const sortGroups = groups =>
  [...groups].sort((a, b) =>
    String(a.groupName).localeCompare(String(b.groupName), undefined, {
      numeric: true
    })
  )

const getPredictionStatus = match => {
  const prediction = userPredictions[match.id]
  const winner = allResults[match.id]?.winner

  if (!prediction || !winner) return ''
  return prediction === winner ? 'correct' : 'wrong'
}

const getPredictionClass = predictionStatus => {
  if (predictionStatus === 'correct') return ' prediction-correct'
  if (predictionStatus === 'wrong') return ' prediction-wrong'
  return ''
}

const renderMatchPanel = teamName => {
  selectedTeam = teamName
  const displayTeamName = translateTeamName(teamName)
  const teamMatches = allMatches.filter(
    match => match.team1 === teamName || match.team2 === teamName
  )

  if (teamMatches.length === 0) {
    matchesPanel.innerHTML = `
      <h2 class="matches-title">${t('groups.upcomingMatches')}</h2>
      <p>${t('groups.noMatchesFor', { team: displayTeamName })}</p>
    `
    return
  }

  const matchesHtml = teamMatches
    .map(match => {
      const prediction = userPredictions[match.id]
      const predictionStatus = getPredictionStatus(match)
      const predictionClass = getPredictionClass(predictionStatus)
      let predictionLabel = ''

      if (prediction) {
        if (prediction === 'team1') {
          predictionLabel = `<span class="prediction-badge${predictionClass}">${translateTeamName(
            match.team1
          )} ✓</span>`
        } else if (prediction === 'team2') {
          predictionLabel = `<span class="prediction-badge${predictionClass}">${translateTeamName(
            match.team2
          )} ✓</span>`
        } else if (prediction === 'draw') {
          predictionLabel = `<span class="prediction-badge${predictionClass}">${t(
            'common.draw'
          )} ✓</span>`
        }
      }

      return `
        <div class="match-row">
          <div class="match-info">
            <strong>${translateTeamName(
              match.team1
            )}</strong> vs <strong>${translateTeamName(match.team2)}</strong>
            <div>${match.date ?? ''} ${match.time ?? ''} ${
        match.round ? `- ${match.round}` : ''
      }</div>
          </div>
          ${predictionLabel}
        </div>
      `
    })
    .join('')

  matchesPanel.innerHTML = `
    <h2 class="matches-title">${t('groups.upcomingMatchesFor', {
      team: displayTeamName
    })}</h2>
    ${matchesHtml}
  `
}

const predictionLabelForMatch = match => {
  const prediction = userPredictions[match.id]
  if (!prediction) return null

  const predictionStatus = getPredictionStatus(match)
  const predictionClass = getPredictionClass(predictionStatus)

  if (prediction === 'team1') {
    return {
      text: `${translateTeamName(match.team1)} ✓`,
      className: predictionClass
    }
  }
  if (prediction === 'team2') {
    return {
      text: `${translateTeamName(match.team2)} ✓`,
      className: predictionClass
    }
  }
  if (prediction === 'draw') {
    return { text: `${t('common.draw')} ✓`, className: predictionClass }
  }
  return null
}

const getGroupMatches = group => {
  const teamSet = new Set(group.teams)
  return allMatches.filter(
    match => teamSet.has(match.team1) && teamSet.has(match.team2)
  )
}

const renderGroupMatches = group => {
  const groupMatches = getGroupMatches(group)
  if (!groupMatches.length) {
    return `<p class="group-matches-empty">${t('groups.noGroupMatches')}</p>`
  }

  return groupMatches
    .map(match => {
      const predictionLabel = predictionLabelForMatch(match)
      return `
        <div class="group-match-row">
        <div class="group-match-meta">${match.date ?? ''} ${
        match.time ?? ''
      }</div>
          <div class="group-match-main">${translateTeamName(
            match.team1
          )} vs ${translateTeamName(match.team2)}</div>
          ${
            predictionLabel
              ? `<span class="group-match-prediction${predictionLabel.className}">${predictionLabel.text}</span>`
              : ''
          }
        </div>
      `
    })
    .join('')
}

const renderGroups = groups => {
  groupsContainer.innerHTML = ''

  groups.forEach(group => {
    const card = document.createElement('article')
    card.className = 'group-card'

    const title = document.createElement('h2')
    title.className = 'group-title'
    title.textContent = t('groups.groupLabel', { group: group.groupName })

    const list = document.createElement('ul')
    group.teams.forEach(team => {
      const li = document.createElement('li')
      li.className = 'team-item'

      const button = document.createElement('button')
      button.className = 'team-btn'
      button.type = 'button'
      button.textContent = translateTeamName(team)
      button.addEventListener('click', () => renderMatchPanel(team))

      li.appendChild(button)
      list.appendChild(li)
    })

    const groupMatchesSection = document.createElement('section')
    groupMatchesSection.className = 'group-matches'
    groupMatchesSection.innerHTML = `
      <h3 class="group-matches-title">${t('groups.groupMatches')}</h3>
      ${renderGroupMatches(group)}
    `

    card.appendChild(title)
    card.appendChild(list)
    card.appendChild(groupMatchesSection)
    groupsContainer.appendChild(card)
  })
}

const run = async () => {
  try {
    const [groups, matches, results, predictions] = await Promise.all([
      getAllGroupTeams(),
      getAllMatchesFlat(),
      getAllMatchResults(),
      currentUser ? getUserPredictions(currentUser.uid) : Promise.resolve([])
    ])

    allGroups = sortGroups(groups)
    allMatches = matches
    allResults = results || {}

    // Build predictions map
    userPredictions = {}
    predictions.forEach(pred => {
      userPredictions[pred.matchId] = pred.prediction
    })

    renderGroups(allGroups)
  } catch (error) {
    groupsContainer.innerHTML = `<p>${t('groups.couldNotLoad')}</p>`
    console.error(error)
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
    console.error('Logout failed:', error)
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

  renderGroups(allGroups)
  if (selectedTeam) {
    renderMatchPanel(selectedTeam)
  } else {
    renderDefaultMatchesPanel()
  }
})
