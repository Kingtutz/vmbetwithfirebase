import {
  getAllMatchesFlat,
  getAllMatchResults,
  getAllTournamentWinnerBets,
  getAllUsers,
  getBetLocks,
  getTournamentWinnerResult,
  getUserProfile,
  isAdminUser,
  logOut,
  onAuthChange,
  setUserNickname,
  setMatchWinner,
  setBetLocks,
  setUserPaid,
  setTournamentWinnerResult,
  setUserWinnerBetPaid,
  removeRegisteredUserData
} from './firebase.js'
import { initI18n, onLanguageChange, t, translateTeamName } from './i18n.js'

const matchesContainer = document.getElementById('matches')
const userEmail = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')
const adminNotice = document.getElementById('adminNotice')
const usersList = document.getElementById('usersList')
const usersNotice = document.getElementById('usersNotice')
const usersBetSummary = document.getElementById('usersBetSummary')
const matchPayoutSummary = document.getElementById('matchPayoutSummary')
const apiFootballKeyInput = document.getElementById('apiFootballKey')
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn')
const syncLiveBtn = document.getElementById('syncLiveBtn')
const apiSyncStatus = document.getElementById('apiSyncStatus')
const matchesLockAtInput = document.getElementById('matchesLockAt')
const winnerLockAtInput = document.getElementById('winnerLockAt')
const saveLocksBtn = document.getElementById('saveLocksBtn')
const clearLocksBtn = document.getElementById('clearLocksBtn')
const locksStatus = document.getElementById('locksStatus')
const winnerResultSelect = document.getElementById('winnerResultSelect')
const saveWinnerResultBtn = document.getElementById('saveWinnerResultBtn')
const winnerResultStatus = document.getElementById('winnerResultStatus')
const winnerPayoutSummary = document.getElementById('winnerPayoutSummary')
const winnerPayoutWinners = document.getElementById('winnerPayoutWinners')
const compactToggle = document.getElementById('compactToggle')

let currentUser = null
let allMatches = []
let allResults = {}
let allUsers = []
let isSaving = false
let isTogglingPaid = false
let isRemovingUser = false
let roundCollapsed = {}
let isSyncingLive = false
let isSavingLocks = false
let betLocks = { matchesLockedAt: '', winnerLockedAt: '' }
let allWinnerBets = []
let winnerResult = null
let isSavingWinnerResult = false
const COMPACT_MODE_KEY = 'adminCompactMode'
let compactMode = window.localStorage.getItem(COMPACT_MODE_KEY) !== 'off'

const WINNER_BET_AMOUNT = 50

initI18n()

const updateCompactToggleLabel = () => {
  if (!compactToggle) return
  compactToggle.textContent = compactMode
    ? t('admin.compactOn')
    : t('admin.compactOff')
}

const applyCompactMode = () => {
  document.body.classList.toggle('compact-mode', compactMode)
  updateCompactToggleLabel()
}

applyCompactMode()

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

const setLocksStatus = message => {
  if (!locksStatus) return
  locksStatus.textContent = message
}

const setWinnerResultStatus = message => {
  if (!winnerResultStatus) return
  winnerResultStatus.textContent = message
}

const getAvailableTeams = () =>
  [...new Set(allMatches.flatMap(match => [match.team1, match.team2]))]
    .filter(Boolean)
    .sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
    )

const renderWinnerResultPanel = () => {
  if (!winnerResultSelect) return

  const teams = getAvailableTeams()
  const selectedWinner = String(winnerResult?.winnerTeam || '')

  winnerResultSelect.innerHTML = [
    `<option value="">${t('admin.selectWinnerResult')}</option>`,
    ...teams.map(
      team =>
        `<option value="${team}" ${
          team === selectedWinner ? 'selected' : ''
        }>${translateTeamName(team)}</option>`
    )
  ].join('')

  winnerResultSelect.disabled = isSavingWinnerResult
  if (saveWinnerResultBtn) saveWinnerResultBtn.disabled = isSavingWinnerResult

  const paidWinnerUsers = allUsers.filter(user => user.hasPaidWinnerBet)
  const totalWinnerPool = paidWinnerUsers.length * WINNER_BET_AMOUNT
  const distributablePool = Math.floor(totalWinnerPool * 0.9)
  const paidWinnerUserIds = new Set(paidWinnerUsers.map(user => user.uid))

  const correctWinnerCount = selectedWinner
    ? allWinnerBets.filter(
        bet =>
          bet.winnerTeam === selectedWinner && paidWinnerUserIds.has(bet.userId)
      ).length
    : 0

  const payoutPerWinner =
    selectedWinner && correctWinnerCount > 0
      ? Math.floor(distributablePool / correctWinnerCount)
      : 0

  const correctWinnerRows = selectedWinner
    ? allWinnerBets.filter(
        bet =>
          bet.winnerTeam === selectedWinner && paidWinnerUserIds.has(bet.userId)
      )
    : []

  if (winnerPayoutSummary) {
    winnerPayoutSummary.textContent = t('admin.winnerPayoutSummary', {
      total: totalWinnerPool,
      pool90: distributablePool,
      winners: correctWinnerCount,
      payout: payoutPerWinner
    })
  }

  if (winnerPayoutWinners) {
    if (!selectedWinner) {
      winnerPayoutWinners.innerHTML = ''
    } else if (!correctWinnerRows.length) {
      winnerPayoutWinners.innerHTML = `<div class="winner-payout-empty">${t(
        'admin.winnerPayoutNoWinners'
      )}</div>`
    } else {
      const userById = new Map(allUsers.map(user => [user.uid, user]))
      const rowsHtml = correctWinnerRows
        .slice()
        .sort((a, b) => String(a.userId).localeCompare(String(b.userId)))
        .map(bet => {
          const user = userById.get(bet.userId)
          const displayName =
            user?.nickname || user?.email || bet.userId || t('common.user')

          return `
            <div class="winner-payout-row">
              <span class="winner-payout-user">${displayName}</span>
              <span class="winner-payout-amount">${t('admin.payoutEach', {
                amount: payoutPerWinner
              })}</span>
            </div>
          `
        })
        .join('')

      winnerPayoutWinners.innerHTML = `
        <div class="winner-payout-title">${t(
          'admin.winnerPayoutBreakdown'
        )}</div>
        ${rowsHtml}
      `
    }
  }
}

const initializeWinnerResultSettings = () => {
  if (!saveWinnerResultBtn || !winnerResultSelect) return

  saveWinnerResultBtn.addEventListener('click', async () => {
    const winnerTeam = String(winnerResultSelect.value || '').trim()
    if (!winnerTeam) {
      setWinnerResultStatus(t('admin.selectWinnerResultFirst'))
      return
    }

    try {
      isSavingWinnerResult = true
      renderWinnerResultPanel()
      const payload = await setTournamentWinnerResult(currentUser, winnerTeam)
      winnerResult = payload
      setWinnerResultStatus(t('admin.winnerResultSaved'))
      renderWinnerResultPanel()
    } catch (error) {
      setWinnerResultStatus(
        error.message || t('admin.couldNotSaveWinnerResult')
      )
    } finally {
      isSavingWinnerResult = false
      renderWinnerResultPanel()
    }
  })
}

const toDateTimeLocalValue = isoValue => {
  if (!isoValue) return ''
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) return ''

  const pad = value => String(value).padStart(2, '0')
  const year = parsed.getFullYear()
  const month = pad(parsed.getMonth() + 1)
  const day = pad(parsed.getDate())
  const hours = pad(parsed.getHours())
  const minutes = pad(parsed.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const toIsoOrEmpty = localValue => {
  const clean = String(localValue || '').trim()
  if (!clean) return ''
  const parsed = new Date(clean)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString()
}

const renderLockInputs = () => {
  if (matchesLockAtInput) {
    matchesLockAtInput.value = toDateTimeLocalValue(betLocks.matchesLockedAt)
    matchesLockAtInput.disabled = isSavingLocks
  }

  if (winnerLockAtInput) {
    winnerLockAtInput.value = toDateTimeLocalValue(betLocks.winnerLockedAt)
    winnerLockAtInput.disabled = isSavingLocks
  }

  if (saveLocksBtn) saveLocksBtn.disabled = isSavingLocks
  if (clearLocksBtn) clearLocksBtn.disabled = isSavingLocks
}

const saveLockSettings = async payload => {
  try {
    isSavingLocks = true
    renderLockInputs()
    const saved = await setBetLocks(currentUser, payload)
    betLocks = {
      matchesLockedAt: saved.matchesLockedAt || '',
      winnerLockedAt: saved.winnerLockedAt || ''
    }
    renderLockInputs()
    setLocksStatus(t('admin.locksSaved'))
  } catch (error) {
    setLocksStatus(error.message || t('admin.couldNotSaveLocks'))
  } finally {
    isSavingLocks = false
    renderLockInputs()
  }
}

const initializeLockSettings = () => {
  if (!saveLocksBtn || !clearLocksBtn) return

  saveLocksBtn.addEventListener('click', async () => {
    await saveLockSettings({
      matchesLockedAt: toIsoOrEmpty(matchesLockAtInput?.value),
      winnerLockedAt: toIsoOrEmpty(winnerLockAtInput?.value)
    })
  })

  clearLocksBtn.addEventListener('click', async () => {
    await saveLockSettings({ matchesLockedAt: '', winnerLockedAt: '' })
    setLocksStatus(t('admin.locksCleared'))
  })
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
  if (winner === 'team1') return translateTeamName(match.team1)
  if (winner === 'team2') return translateTeamName(match.team2)
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
          <span class="team-name">${translateTeamName(match.team1)}</span>
          <span class="vs">VS</span>
          <span class="team-name">${translateTeamName(match.team2)}</span>
        </div>
        <div class="winner-buttons">
          <button class="winner-btn ${
            winner === 'team1' ? 'active' : ''
          }" data-match-id="${match.id}" data-winner="team1" ${
    isSaving ? 'disabled' : ''
  }>
            ${translateTeamName(match.team1)}
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
            ${translateTeamName(match.team2)}
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

const toggleRoundSection = section => {
  if (!section) return

  const btn = section.querySelector('.round-toggle-btn')
  const grid = section.querySelector('.round-matches-grid')
  const roundName = btn?.dataset.round
  if (!roundName) return

  const nextCollapsed = !Boolean(roundCollapsed[roundName])
  roundCollapsed[roundName] = nextCollapsed

  section.classList.toggle('collapsed', nextCollapsed)
  if (grid) {
    grid.classList.toggle('collapsed', nextCollapsed)
  }
  btn.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true')

  const chevron = btn.querySelector('.round-chevron')
  if (chevron) {
    chevron.classList.toggle('collapsed', nextCollapsed)
  }
}

const attachRoundToggleHandlers = () => {
  document.querySelectorAll('.round-header').forEach(header => {
    header.addEventListener('click', event => {
      const target = event.target
      if (target instanceof HTMLElement) {
        // Keep other controls in the header safe if any are added later.
        if (
          target.closest('.winner-btn') ||
          target.closest('.toggle-paid-btn')
        ) {
          return
        }
      }

      const section = header.closest('.round-section')
      toggleRoundSection(section)
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
  const firstPrize = Math.round(totalBet * 0.65)
  const secondPrize = Math.round(totalBet * 0.15)
  const thirdPrize = Math.round(totalBet * 0.1)
  const restPool = totalBet - firstPrize - secondPrize - thirdPrize

  if (usersBetSummary) {
    usersBetSummary.textContent = t('admin.totalBet', { amount: totalBet })
  }

  if (matchPayoutSummary) {
    matchPayoutSummary.textContent = t('admin.matchPayoutSummary', {
      total: totalBet,
      first: firstPrize,
      second: secondPrize,
      third: thirdPrize,
      rest: restPool
    })
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
          ${t('admin.matchBetLabel')}: ${
        u.hasPaid ? t('admin.paid') : t('admin.unpaid')
      }
        </span>
        <button
          class="toggle-paid-btn"
          data-type="match"
          data-uid="${u.uid}"
          data-paid="${u.hasPaid}"
          ${isTogglingPaid || isRemovingUser ? 'disabled' : ''}>
          ${u.hasPaid ? t('admin.markUnpaid') : t('admin.markPaid')}
        </button>
        <span class="paid-badge ${u.hasPaidWinnerBet ? 'paid' : 'unpaid'}">
          ${t('admin.winnerBetLabel')}: ${
        u.hasPaidWinnerBet ? t('admin.paid') : t('admin.unpaid')
      }
        </span>
        <button
          class="toggle-paid-btn"
          data-type="winner"
          data-uid="${u.uid}"
          data-paid="${u.hasPaidWinnerBet}"
          ${isTogglingPaid || isRemovingUser ? 'disabled' : ''}>
          ${
            u.hasPaidWinnerBet
              ? t('admin.markWinnerUnpaid')
              : t('admin.markWinnerPaid')
          }
        </button>
        <button
          class="remove-user-btn"
          data-uid="${u.uid}"
          ${isTogglingPaid || isRemovingUser ? 'disabled' : ''}>
          ${t('admin.removeUser')}
        </button>
      </div>`
    )
    .join('')

  usersList.innerHTML = rows
  attachPaymentHandlers()
  attachRemoveUserHandlers()
}

const attachPaymentHandlers = () => {
  usersList.querySelectorAll('.toggle-paid-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid
      const currentPaid = btn.dataset.paid === 'true'
      const paymentType = btn.dataset.type
      if (!uid || isTogglingPaid) return

      try {
        isTogglingPaid = true
        renderUsers()
        if (paymentType === 'winner') {
          await setUserWinnerBetPaid(uid, !currentPaid)
        } else {
          await setUserPaid(uid, !currentPaid)
        }
        const user = allUsers.find(u => u.uid === uid)
        if (user) {
          if (paymentType === 'winner') {
            user.hasPaidWinnerBet = !currentPaid
          } else {
            user.hasPaid = !currentPaid
          }
        }
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

const attachRemoveUserHandlers = () => {
  usersList.querySelectorAll('.remove-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid
      if (!uid || isRemovingUser || isTogglingPaid) return

      const userToRemove = allUsers.find(user => user.uid === uid)
      const displayName =
        userToRemove?.nickname ||
        userToRemove?.email ||
        userToRemove?.uid ||
        uid

      const confirmed = window.confirm(
        t('admin.confirmRemoveUser', { name: displayName })
      )
      if (!confirmed) return

      try {
        isRemovingUser = true
        renderUsers()

        await removeRegisteredUserData(currentUser, uid)

        allUsers = allUsers.filter(user => user.uid !== uid)
        allWinnerBets = allWinnerBets.filter(bet => bet.userId !== uid)
        usersNotice.style.display = 'block'
        usersNotice.textContent = t('admin.userRemoved', { name: displayName })
        renderWinnerResultPanel()
      } catch (error) {
        usersNotice.style.display = 'block'
        usersNotice.textContent = error.message || t('admin.couldNotRemoveUser')
      } finally {
        isRemovingUser = false
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

  const [matches, results, users, locks, winnerBets, winnerResultPayload] =
    await Promise.all([
      getAllMatchesFlat(),
      getAllMatchResults(),
      getAllUsers(),
      getBetLocks(),
      getAllTournamentWinnerBets(),
      getTournamentWinnerResult()
    ])

  allMatches = matches
  allResults = results || {}
  allUsers = users || []
  betLocks = locks || { matchesLockedAt: '', winnerLockedAt: '' }
  allWinnerBets = winnerBets || []
  winnerResult = winnerResultPayload || null
  renderLockInputs()
  renderWinnerResultPanel()
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
      roundCollapsed[roundName] = true
    }
  })

  adminNotice.style.display = 'none'
  renderMatches(allMatches)
  renderUsers()
}

initializeApiSyncPanel()
initializeLockSettings()
initializeWinnerResultSettings()

compactToggle?.addEventListener('click', () => {
  compactMode = !compactMode
  window.localStorage.setItem(COMPACT_MODE_KEY, compactMode ? 'on' : 'off')
  applyCompactMode()
})

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
  updateCompactToggleLabel()
  attachNicknameEditor(userEmail.textContent)
  renderLockInputs()
  renderWinnerResultPanel()
  renderMatches(allMatches)
  renderUsers()
  if (
    !apiSyncStatus.textContent ||
    apiSyncStatus.textContent === t('admin.apiKeySaved')
  ) {
    setApiSyncStatus('')
  }
})
