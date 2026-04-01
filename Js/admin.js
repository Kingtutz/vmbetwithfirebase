import {
  getAllMatchesFlat,
  getAllMatchResults,
  getAllUsers,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setUserNickname,
  setMatchWinner,
  setUserPaid
} from './firebase.js'
import { initI18n, onLanguageChange, t } from './i18n.js'

const matchesContainer = document.getElementById('matches')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNotice = document.getElementById('adminNotice')
const usersList = document.getElementById('usersList')
const usersNotice = document.getElementById('usersNotice')
const usersBetSummary = document.getElementById('usersBetSummary')
const apiFootballKeyInput = document.getElementById('apiFootballKey')
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn')
const syncLiveBtn = document.getElementById('syncLiveBtn')
const apiSyncStatus = document.getElementById('apiSyncStatus')

let currentUser = null
let allMatches = []
let allResults = {}
let allUsers = []
let isSaving = false
let isTogglingPaid = false
let roundCollapsed = {}
let isSyncingLive = false

initI18n()

const API_FOOTBALL_KEY_STORAGE = 'apiFootballKey'
const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io'
const WORLD_CUP_LEAGUE_ID = 1
const WORLD_CUP_SEASON = 2026

const TEAM_NAME_ALIASES = {
  mexiko: 'Mexico',
  sydafrika: 'South Africa',
  sydkorea: 'South Korea',
  tjeckien: 'Czech Republic',
  kanada: 'Canada',
  bosnienhercegovina: 'Bosnia and Herzegovina',
  usa: 'United States',
  qatar: 'Qatar',
  schweiz: 'Switzerland',
  brasilien: 'Brazil',
  marocko: 'Morocco',
  haiti: 'Haiti',
  skottland: 'Scotland',
  australien: 'Australia',
  turkiet: 'Turkey',
  tyskland: 'Germany',
  nederlanderna: 'Netherlands',
  elfenbenskusten: 'Ivory Coast',
  sverige: 'Sweden',
  tunisien: 'Tunisia',
  spanien: 'Spain',
  belgien: 'Belgium',
  egypten: 'Egypt',
  saudiarabien: 'Saudi Arabia',
  uruguay: 'Uruguay',
  iran: 'Iran',
  frankrike: 'France',
  senegal: 'Senegal',
  irak: 'Iraq',
  norge: 'Norway',
  argentina: 'Argentina',
  algeriet: 'Algeria',
  osterrike: 'Austria',
  jordan: 'Jordan',
  portugal: 'Portugal',
  drkongo: 'DR Congo',
  england: 'England',
  kroatien: 'Croatia',
  ghana: 'Ghana',
  panama: 'Panama',
  uzbekistan: 'Uzbekistan',
  colombia: 'Colombia',
  paraguay: 'Paraguay',
  curacao: 'Curacao',
  kapverde: 'Cape Verde'
}

const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])

const normalizeTeamName = name =>
  String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const toApiComparableTeamName = name => {
  const normalized = normalizeTeamName(name)
  const aliased = TEAM_NAME_ALIASES[normalized] || name
  return normalizeTeamName(aliased)
}

const fixtureKey = (homeName, awayName) => {
  const a = toApiComparableTeamName(homeName)
  const b = toApiComparableTeamName(awayName)
  return [a, b].sort().join('|')
}

const getStoredApiFootballKey = () =>
  window.localStorage.getItem(API_FOOTBALL_KEY_STORAGE) || ''

const setStoredApiFootballKey = key => {
  window.localStorage.setItem(API_FOOTBALL_KEY_STORAGE, key)
}

const setApiSyncStatus = message => {
  if (!apiSyncStatus) return
  apiSyncStatus.textContent = message
}

const setApiControlsDisabled = disabled => {
  if (saveApiKeyBtn) saveApiKeyBtn.disabled = disabled
  if (syncLiveBtn) syncLiveBtn.disabled = disabled
  if (apiFootballKeyInput) apiFootballKeyInput.disabled = disabled
}

const fetchWorldCupFixtures = async apiKey => {
  const url =
    `${API_FOOTBALL_BASE_URL}/fixtures?league=${WORLD_CUP_LEAGUE_ID}` +
    `&season=${WORLD_CUP_SEASON}`

  const response = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey
    }
  })

  if (!response.ok) {
    throw new Error(t('admin.apiRequestFailed'))
  }

  const payload = await response.json()
  return payload?.response || []
}

const getApiWinnerForMatch = (match, fixture) => {
  const goalsHome = fixture?.goals?.home
  const goalsAway = fixture?.goals?.away

  if (goalsHome == null || goalsAway == null) return null

  const homeKey = toApiComparableTeamName(fixture?.teams?.home?.name)
  const awayKey = toApiComparableTeamName(fixture?.teams?.away?.name)
  const localTeam1Key = toApiComparableTeamName(match.team1)
  const localTeam2Key = toApiComparableTeamName(match.team2)

  const isNormalOrder = homeKey === localTeam1Key && awayKey === localTeam2Key
  const isSwappedOrder = homeKey === localTeam2Key && awayKey === localTeam1Key

  if (!isNormalOrder && !isSwappedOrder) return null

  if (goalsHome === goalsAway) return 'draw'

  if (isNormalOrder) {
    return goalsHome > goalsAway ? 'team1' : 'team2'
  }

  return goalsHome > goalsAway ? 'team2' : 'team1'
}

const buildFinishedFixtureMap = fixtures => {
  const map = new Map()

  fixtures.forEach(fixture => {
    const statusShort = String(
      fixture?.fixture?.status?.short || ''
    ).toUpperCase()
    if (!FINAL_STATUSES.has(statusShort)) return

    const homeName = fixture?.teams?.home?.name
    const awayName = fixture?.teams?.away?.name
    if (!homeName || !awayName) return

    map.set(fixtureKey(homeName, awayName), fixture)
  })

  return map
}

const syncLiveScoresFromApiFootball = async () => {
  if (isSyncingLive || !currentUser) return

  const apiKey = String(apiFootballKeyInput?.value || '').trim()
  if (!apiKey) {
    setApiSyncStatus(t('admin.addSaveKeyFirst'))
    return
  }

  try {
    isSyncingLive = true
    setApiControlsDisabled(true)
    setApiSyncStatus(t('admin.syncing'))

    const fixtures = await fetchWorldCupFixtures(apiKey)
    const finishedMap = buildFinishedFixtureMap(fixtures)

    let updatedCount = 0
    let skippedCount = 0

    for (const match of allMatches) {
      const fixture = finishedMap.get(fixtureKey(match.team1, match.team2))
      if (!fixture) continue

      const winner = getApiWinnerForMatch(match, fixture)
      if (!winner) {
        skippedCount += 1
        continue
      }

      if (allResults[match.id]?.winner === winner) continue

      const payload = await setMatchWinner(currentUser, match.id, winner)
      allResults[match.id] = payload
      updatedCount += 1
    }

    renderMatches(allMatches)
    setApiSyncStatus(
      t('admin.syncComplete', {
        updated: updatedCount,
        skipped: skippedCount
      })
    )
  } catch (error) {
    setApiSyncStatus(error.message || t('admin.syncFailed'))
  } finally {
    isSyncingLive = false
    setApiControlsDisabled(false)
  }
}

const initializeApiSyncPanel = () => {
  if (!apiFootballKeyInput || !saveApiKeyBtn || !syncLiveBtn) return

  apiFootballKeyInput.value = getStoredApiFootballKey()

  saveApiKeyBtn.addEventListener('click', () => {
    const key = String(apiFootballKeyInput.value || '').trim()
    if (!key) {
      setApiSyncStatus(t('admin.apiKeyEmpty'))
      return
    }

    setStoredApiFootballKey(key)
    setApiSyncStatus(t('admin.apiKeySaved'))
  })

  syncLiveBtn.addEventListener('click', async () => {
    await syncLiveScoresFromApiFootball()
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
      console.error('Nickname update failed:', error)
      window.alert(error.message || t('nickname.updateFailed'))
    }
  }
}

const winnerLabel = (winner, match) => {
  if (winner === 'team1') return match.team1
  if (winner === 'team2') return match.team2
  if (winner === 'draw') return t('common.draw')
  return t('common.notSet')
}

const renderMatchCard = match => {
  const result = allResults[match.id]
  const winner = result?.winner

  return `
    <article class="match-card">
      <div class="match-header">
        <div>${match.date ?? ''} ${match.time ?? ''}</div>
        <div>${match.round ?? ''}</div>
      </div>
      <div class="match-content">
        <div class="teams">
          <span class="team-name">${match.team1}</span>
          <span class="vs">VS</span>
          <span class="team-name">${match.team2}</span>
        </div>
        <div class="winner-buttons">
          <button class="winner-btn ${
            winner === 'team1' ? 'active' : ''
          }" data-match-id="${match.id}" data-winner="team1" ${
    isSaving ? 'disabled' : ''
  }>
            ${match.team1}
          </button>
          <button class="winner-btn ${
            winner === 'draw' ? 'active' : ''
          }" data-match-id="${match.id}" data-winner="draw" ${
    isSaving ? 'disabled' : ''
  }>
            ${t('common.draw')}
          </button>
          <button class="winner-btn ${
            winner === 'team2' ? 'active' : ''
          }" data-match-id="${match.id}" data-winner="team2" ${
    isSaving ? 'disabled' : ''
  }>
            ${match.team2}
          </button>
        </div>
        <div class="current-winner">${t('common.currentWinner', {
          winner: winnerLabel(winner, match)
        })}</div>
      </div>
    </article>
  `
}

const getGroupedMatches = matches => {
  const grouped = {}

  matches.forEach(match => {
    const roundName = String(match.round || t('common.notSet'))
    if (!grouped[roundName]) {
      grouped[roundName] = []
    }
    grouped[roundName].push(match)
  })

  return Object.entries(grouped).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )
}

const renderRoundSection = (roundName, roundMatches) => {
  const isCollapsed = Boolean(roundCollapsed[roundName])

  return `
    <section class="round-section ${
      isCollapsed ? 'collapsed' : ''
    }" data-round-section="${roundName}">
      <div class="round-header">
        <span class="round-title">${roundName}</span>
        <span class="round-meta">${t('common.matchesCount', {
          count: roundMatches.length
        })}</span>
        <button
          class="round-toggle-btn"
          type="button"
          data-round="${roundName}"
          aria-expanded="${isCollapsed ? 'false' : 'true'}"
        >
          <span class="round-chevron ${isCollapsed ? 'collapsed' : ''}">▾</span>
        </button>
      </div>
      <div class="round-matches-grid ${isCollapsed ? 'collapsed' : ''}">
        ${roundMatches.map(renderMatchCard).join('')}
      </div>
    </section>
  `
}

const attachRoundToggleHandlers = () => {
  document.querySelectorAll('.round-toggle-btn').forEach(btn => {
    btn.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()

      const roundName = btn.dataset.round
      if (!roundName) return

      const section = document.querySelector(
        `[data-round-section="${CSS.escape(roundName)}"]`
      )
      const nextCollapsed = !Boolean(roundCollapsed[roundName])

      roundCollapsed[roundName] = nextCollapsed

      if (section) {
        section.classList.toggle('collapsed', nextCollapsed)
      }

      btn.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true')
      const chevron = btn.querySelector('.round-chevron')
      if (chevron) {
        chevron.classList.toggle('collapsed', nextCollapsed)
      }
    })
  })
}

const attachWinnerHandlers = () => {
  document.querySelectorAll('.winner-btn').forEach(btn => {
    btn.addEventListener('click', async event => {
      event.stopPropagation()

      const matchId = btn.dataset.matchId
      const winner = btn.dataset.winner
      if (!matchId || !winner || isSaving) return

      try {
        isSaving = true
        renderMatches(allMatches)
        const payload = await setMatchWinner(currentUser, matchId, winner)
        allResults[matchId] = payload
        adminNotice.style.display = 'none'
      } catch (error) {
        adminNotice.style.display = 'block'
        adminNotice.textContent = error.message || t('admin.couldNotSaveWinner')
      } finally {
        isSaving = false
        renderMatches(allMatches)
      }
    })
  })
}

const renderMatches = matches => {
  if (!matches.length) {
    matchesContainer.innerHTML = `<p>${t('admin.noMatchesFound')}</p>`
    return
  }

  const groupedMatches = getGroupedMatches(matches)
  matchesContainer.innerHTML = groupedMatches
    .map(([roundName, roundMatches]) =>
      renderRoundSection(roundName, roundMatches)
    )
    .join('')

  attachRoundToggleHandlers()
  attachWinnerHandlers()
}

const renderUsers = () => {
  const paidUsersCount = allUsers.filter(user => user.hasPaid).length
  const totalBet = paidUsersCount * 100

  if (usersBetSummary) {
    usersBetSummary.textContent = t('admin.totalBet', { amount: totalBet })
  }

  if (!allUsers.length) {
    usersList.innerHTML = `<p class="users-empty">${t('admin.noUsers')}</p>`
    return
  }

  const rows = allUsers
    .slice()
    .sort((a, b) =>
      (a.nickname || a.email || a.uid).localeCompare(
        b.nickname || b.email || b.uid
      )
    )
    .map(
      u => `
      <div class="user-row">
        <div class="user-identity">
          <span class="user-name">${u.nickname || u.email || u.uid}</span>
          ${
            u.nickname && u.email
              ? `<span class="user-email">${u.email}</span>`
              : ''
          }
        </div>
        <span class="paid-badge ${u.hasPaid ? 'paid' : 'unpaid'}">
          ${u.hasPaid ? t('admin.paid') : t('admin.unpaid')}
        </span>
        <button
          class="toggle-paid-btn"
          data-uid="${u.uid}"
          data-paid="${u.hasPaid}"
          ${isTogglingPaid ? 'disabled' : ''}>
          ${u.hasPaid ? t('admin.markUnpaid') : t('admin.markPaid')}
        </button>
      </div>`
    )
    .join('')

  usersList.innerHTML = rows
  attachPaymentHandlers()
}

const attachPaymentHandlers = () => {
  usersList.querySelectorAll('.toggle-paid-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid
      const currentPaid = btn.dataset.paid === 'true'
      if (!uid || isTogglingPaid) return

      try {
        isTogglingPaid = true
        renderUsers()
        await setUserPaid(uid, !currentPaid)
        const user = allUsers.find(u => u.uid === uid)
        if (user) user.hasPaid = !currentPaid
        usersNotice.style.display = 'none'
      } catch (error) {
        usersNotice.style.display = 'block'
        usersNotice.textContent =
          error.message || t('admin.couldNotUpdatePayment')
      } finally {
        isTogglingPaid = false
        renderUsers()
      }
    })
  })
}

const loadPage = async () => {
  const admin = await isAdminUser(currentUser)
  if (!admin) {
    adminNotice.style.display = 'block'
    adminNotice.textContent = t('admin.notAdmin')
    matchesContainer.innerHTML = ''
    usersList.innerHTML = ''
    return
  }

  const [matches, results, users] = await Promise.all([
    getAllMatchesFlat(),
    getAllMatchResults(),
    getAllUsers()
  ])

  allMatches = matches
  allResults = results || {}
  allUsers = users || []
  const availableRounds = new Set(
    allMatches.map(match => String(match.round || t('common.notSet')))
  )

  Object.keys(roundCollapsed).forEach(roundName => {
    if (!availableRounds.has(roundName)) {
      delete roundCollapsed[roundName]
    }
  })

  availableRounds.forEach(roundName => {
    if (!(roundName in roundCollapsed)) {
      roundCollapsed[roundName] = false
    }
  })

  adminNotice.style.display = 'none'
  renderMatches(allMatches)
  renderUsers()
}

initializeApiSyncPanel()

logoutBtn.addEventListener('click', async () => {
  try {
    await logOut()
    window.location.href = 'login.html'
  } catch (error) {
    adminNotice.style.display = 'block'
    adminNotice.textContent = error.message || t('common.logoutFailed')
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

  try {
    await loadPage()
  } catch (error) {
    adminNotice.style.display = 'block'
    adminNotice.textContent = error.message || t('admin.couldNotLoadPage')
  }
})

onLanguageChange(() => {
  logoutBtn.textContent = t('common.logout')
  attachNicknameEditor(userEmail.textContent)
  renderMatches(allMatches)
  renderUsers()
  if (
    !apiSyncStatus.textContent ||
    apiSyncStatus.textContent === t('admin.apiKeySaved')
  ) {
    setApiSyncStatus('')
  }
})
