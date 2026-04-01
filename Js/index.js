import {
  getAllGroupTeams,
  getAllMatchesFlat,
  getUserProfile,
  getUserPredictions,
  isAdminUser,
  onAuthChange,
  logOut,
  setUserNickname
} from './firebase.js'

const groupsContainer = document.getElementById('groups')
const searchInput = document.getElementById('teamSearch')
const matchesPanel = document.getElementById('matchesPanel')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNavLink = document.querySelector('.nav-buttons a[href="admin.html"]')
const matchesNavLink = document.querySelector(
  '.nav-buttons a[href="bets.html"]'
)

let allGroups = []
let allMatches = []
let userPredictions = {}
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
    } catch (error) {
      console.error('Nickname update failed:', error)
      window.alert(error.message || 'Could not update nickname.')
    }
  }
}

const sortGroups = groups =>
  [...groups].sort((a, b) =>
    String(a.groupName).localeCompare(String(b.groupName), undefined, {
      numeric: true
    })
  )

const renderMatchPanel = teamName => {
  const teamMatches = allMatches.filter(
    match => match.team1 === teamName || match.team2 === teamName
  )

  if (teamMatches.length === 0) {
    matchesPanel.innerHTML = `
      <h2 class="matches-title">Upcoming Matches</h2>
      <p>No matches found for <strong>${teamName}</strong>.</p>
    `
    return
  }

  const matchesHtml = teamMatches
    .map(match => {
      const prediction = userPredictions[match.id]
      let predictionLabel = ''

      if (prediction) {
        if (prediction === 'team1') {
          predictionLabel = `<span class="prediction-badge">${match.team1} ✓</span>`
        } else if (prediction === 'team2') {
          predictionLabel = `<span class="prediction-badge">${match.team2} ✓</span>`
        } else if (prediction === 'draw') {
          predictionLabel = `<span class="prediction-badge">Draw ✓</span>`
        }
      }

      return `
        <div class="match-row">
          <div class="match-info">
            <strong>${match.team1}</strong> vs <strong>${match.team2}</strong>
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
    <h2 class="matches-title">Upcoming Matches - ${teamName}</h2>
    ${matchesHtml}
  `
}

const predictionLabelForMatch = match => {
  const prediction = userPredictions[match.id]
  if (!prediction) return ''

  if (prediction === 'team1') return `${match.team1} ✓`
  if (prediction === 'team2') return `${match.team2} ✓`
  if (prediction === 'draw') return 'Draw ✓'
  return ''
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
    return '<p class="group-matches-empty">No group matches found yet.</p>'
  }

  return groupMatches
    .map(match => {
      const predictionLabel = predictionLabelForMatch(match)
      return `
        <div class="group-match-row">
        <div class="group-match-meta">${match.date ?? ''} ${
        match.time ?? ''
      }</div>
          <div class="group-match-main">${match.team1} vs ${match.team2}</div>
          ${
            predictionLabel
              ? `<span class="group-match-prediction">${predictionLabel}</span>`
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
    title.textContent = `Group ${group.groupName}`

    const list = document.createElement('ul')
    group.teams.forEach(team => {
      const li = document.createElement('li')
      li.className = 'team-item'

      const button = document.createElement('button')
      button.className = 'team-btn'
      button.type = 'button'
      button.textContent = team
      button.addEventListener('click', () => renderMatchPanel(team))

      li.appendChild(button)
      list.appendChild(li)
    })

    const groupMatchesSection = document.createElement('section')
    groupMatchesSection.className = 'group-matches'
    groupMatchesSection.innerHTML = `
      <h3 class="group-matches-title">Group Matches</h3>
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
      teams: group.teams.filter(team => team.toLowerCase().includes(query))
    }))
    .filter(group => group.teams.length > 0)

  renderGroups(filtered)
}

const run = async () => {
  try {
    const [groups, matches, predictions] = await Promise.all([
      getAllGroupTeams(),
      getAllMatchesFlat(),
      currentUser ? getUserPredictions(currentUser.uid) : Promise.resolve([])
    ])

    allGroups = sortGroups(groups)
    allMatches = matches

    // Build predictions map
    userPredictions = {}
    predictions.forEach(pred => {
      userPredictions[pred.matchId] = pred.prediction
    })

    renderGroups(allGroups)
  } catch (error) {
    groupsContainer.innerHTML = '<p>Could not load groups from Firebase.</p>'
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
