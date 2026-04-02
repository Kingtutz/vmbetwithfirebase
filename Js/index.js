import {
  getAllGroupTeams,
  getAllMatchResults,
  getAllMatchesFlat,
  getUserProfile,
  getUserPredictions,
  isAdminUser,
  onAuthChange,
  logOut,
  setUserNickname
} from './firebase.js'
import { initI18n, onLanguageChange, t, translateTeamName } from './i18n.js'

const groupsContainer = document.getElementById('groups')
const searchInput = document.getElementById('teamSearch')
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
      console.error('Nickname update failed:', error)
      window.alert(error.message || t('nickname.updateFailed'))
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

const applySearch = () => {
  const query = searchInput.value.trim().toLowerCase()
  if (!query) {
    renderGroups(allGroups)
    return
  }

  const filtered = allGroups
    .map(group => ({
      ...group,
      teams: group.teams.filter(team => {
        const rawName = team.toLowerCase()
        const translatedName = translateTeamName(team).toLowerCase()
        return rawName.includes(query) || translatedName.includes(query)
      })
    }))
    .filter(group => group.teams.length > 0)

  renderGroups(filtered)
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

searchInput.addEventListener('input', applySearch)

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

  renderGroups(allGroups)
  if (selectedTeam) {
    renderMatchPanel(selectedTeam)
  } else {
    renderDefaultMatchesPanel()
  }
})
