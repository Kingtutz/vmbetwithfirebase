import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'
import {
  getDatabase,
  get,
  ref,
  push,
  set,
  update,
  remove
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateEmail,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js'

const firebaseConfig = {
  apiKey: 'AIzaSyB00nizZorhQYEbE_MtrHzXBvkgkMllaAE',
  authDomain: 'vm2026-2f0da.firebaseapp.com',
  databaseURL:
    'https://vm2026-2f0da-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'vm2026-2f0da',
  storageBucket: 'vm2026-2f0da.firebasestorage.app',
  messagingSenderId: '997890625005',
  appId: '1:997890625005:web:2620d50d89f4c98aa1ebe4',
  measurementId: 'G-FG1MPBSJ5X'
}

export const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const auth = getAuth(app)
export const groupRef = ref(db, 'groups')
export const matcheReF = ref(db, 'matches')
const ADMIN_EMAILS = ['challe-1992@hotmail.com']

const snapshotToList = snapshot => {
  if (!snapshot.exists()) return []

  const value = snapshot.val()
  if (Array.isArray(value)) return value.filter(item => item != null)

  return Object.entries(value).map(([id, item]) => ({
    id,
    ...item
  }))
}

export const getAllMatches = async () => {
  const snapshot = await get(matcheReF)
  return snapshotToList(snapshot)
}

export const getAllMatchesFlat = async () => {
  const snapshot = await get(matcheReF)
  if (!snapshot.exists()) return []

  const value = snapshot.val()

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  const keys = Object.keys(value)
  const hasRoundArrays = keys.some(
    key => Array.isArray(value[key]) || key.toLowerCase().includes('omg')
  )

  if (!hasRoundArrays) {
    return Object.entries(value).map(([id, item]) => ({ id, ...item }))
  }

  const flattened = []
  for (const [roundName, roundMatches] of Object.entries(value)) {
    if (!Array.isArray(roundMatches)) continue

    roundMatches.forEach((match, index) => {
      flattened.push({
        id: `${roundName}-${index}`,
        round: roundName,
        ...match
      })
    })
  }

  return flattened
}

export const getAllGroups = async () => {
  const snapshot = await get(groupRef)
  return snapshotToList(snapshot)
}

export const getAllGroupTeams = async () => {
  const snapshot = await get(groupRef)
  if (!snapshot.exists()) return []

  const groupsValue = snapshot.val()
  return Object.entries(groupsValue).map(([groupName, teamsObj]) => ({
    groupName,
    teams: Object.keys(teamsObj || {})
  }))
}

export const signUp = async (email, password, nickname = '') => {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  const cleanNickname = String(nickname || '').trim()
  await update(ref(db, `users/${result.user.uid}`), {
    email: result.user.email || email,
    nickname: cleanNickname,
    updatedAt: new Date().toISOString()
  })
  return result.user
}

export const logIn = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password)
  await update(ref(db, `users/${result.user.uid}`), {
    email: result.user.email || email,
    updatedAt: new Date().toISOString()
  })
  return result.user
}

export const getTournamentWinnerBet = async userId => {
  if (!userId) return null

  const betRef = ref(db, `tournamentWinnerBets/${userId}`)
  const snapshot = await get(betRef)
  if (!snapshot.exists()) return null

  return snapshot.val() || null
}

export const setTournamentWinnerBet = async (userId, winnerTeam) => {
  if (!userId) {
    throw new Error('Missing user id')
  }

  const cleanWinnerTeam = String(winnerTeam || '').trim()
  if (!cleanWinnerTeam) {
    throw new Error('Missing winner team')
  }

  const payload = {
    winnerTeam: cleanWinnerTeam,
    madePredictionAt: new Date().toISOString()
  }

  await set(ref(db, `tournamentWinnerBets/${userId}`), payload)
  return payload
}

export const getAllTournamentWinnerBets = async () => {
  const betsRef = ref(db, 'tournamentWinnerBets')
  const snapshot = await get(betsRef)
  if (!snapshot.exists()) return []

  return Object.entries(snapshot.val() || {}).map(([userId, bet]) => ({
    userId,
    winnerTeam: String(bet?.winnerTeam || '').trim(),
    madePredictionAt: bet?.madePredictionAt || ''
  }))
}

export const getTournamentWinnerResult = async () => {
  const resultRef = ref(db, 'settings/tournamentWinnerResult')
  const snapshot = await get(resultRef)
  if (!snapshot.exists()) return null
  return snapshot.val() || null
}

export const setTournamentWinnerResult = async (user, winnerTeam) => {
  const admin = await isAdminUser(user)
  if (!admin) {
    throw new Error('Only admins can set tournament winner result')
  }

  const cleanWinnerTeam = String(winnerTeam || '').trim()
  if (!cleanWinnerTeam) {
    throw new Error('Missing winner team')
  }

  const payload = {
    winnerTeam: cleanWinnerTeam,
    setAt: new Date().toISOString(),
    setByUid: user?.uid || '',
    setByEmail: user?.email || ''
  }

  await set(ref(db, 'settings/tournamentWinnerResult'), payload)
  return payload
}

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  const result = await signInWithPopup(auth, provider)
  const user = result.user
  const userRef = ref(db, `users/${user.uid}`)
  const snapshot = await get(userRef)
  const profile = snapshot.exists() ? snapshot.val() || {} : {}

  const nickname =
    String(profile.nickname || '').trim() ||
    String(user.displayName || '').trim() ||
    String((user.email || '').split('@')[0] || '').trim()

  await update(userRef, {
    email: user.email || '',
    nickname,
    updatedAt: new Date().toISOString()
  })

  return user
}

export const setUserNickname = async (userId, nickname) => {
  if (!userId) {
    throw new Error('Missing user id')
  }

  const cleanNickname = String(nickname || '').trim()
  if (!cleanNickname) {
    throw new Error('Nickname cannot be empty')
  }

  await update(ref(db, `users/${userId}`), {
    nickname: cleanNickname,
    updatedAt: new Date().toISOString()
  })

  return cleanNickname
}

export const updateUserEmail = async (user, newEmail) => {
  if (!user) throw new Error('User not authenticated')

  const cleanEmail = String(newEmail || '').trim()
  if (!cleanEmail) throw new Error('Email cannot be empty')

  await updateEmail(user, cleanEmail)
  await update(ref(db, `users/${user.uid}`), {
    email: cleanEmail,
    updatedAt: new Date().toISOString()
  })

  return cleanEmail
}

export const updateUserPassword = async (user, newPassword) => {
  if (!user) throw new Error('User not authenticated')

  const cleanPassword = String(newPassword || '').trim()
  if (!cleanPassword) throw new Error('Password cannot be empty')
  if (cleanPassword.length < 6)
    throw new Error('Password must be at least 6 characters')

  await updatePassword(user, cleanPassword)
  return true
}

export const getUserProfile = async userId => {
  if (!userId) return {}

  const userRef = ref(db, `users/${userId}`)
  const snapshot = await get(userRef)
  if (!snapshot.exists()) return {}

  return snapshot.val() || {}
}

export const logOut = async () => {
  await signOut(auth)
}

export const makePrediction = async (userId, matchId, prediction) => {
  const predictionsRef = ref(db, `predictions/${userId}/${matchId}`)
  const predictionData = {
    matchId,
    prediction,
    madePredictionAt: new Date().toISOString()
  }
  await set(predictionsRef, predictionData)
  return { matchId, ...predictionData }
}

export const makeBatchPredictions = async (userId, predictionsMap) => {
  if (!userId || !predictionsMap || Object.keys(predictionsMap).length === 0) {
    throw new Error('No predictions to save')
  }

  const updates_obj = {}
  for (const [matchId, prediction] of Object.entries(predictionsMap)) {
    updates_obj[`predictions/${userId}/${matchId}`] = {
      matchId,
      prediction,
      madePredictionAt: new Date().toISOString()
    }
  }

  const dbRef = ref(getDatabase())
  await update(dbRef, updates_obj)
  return true
}

export const getUserPredictions = async userId => {
  const predictionsRef = ref(db, `predictions/${userId}`)
  const snapshot = await get(predictionsRef)
  if (!snapshot.exists()) return []

  const predictionsValue = snapshot.val()
  return Object.entries(predictionsValue).map(([matchId, prediction]) => ({
    matchId,
    ...prediction
  }))
}

export const isAdminUser = async user => {
  if (!user) return false

  const email = String(user.email || '').toLowerCase()
  if (ADMIN_EMAILS.includes(email)) {
    return true
  }

  const adminRef = ref(db, `admins/${user.uid}`)
  const adminSnapshot = await get(adminRef)
  if (!adminSnapshot.exists()) return false

  const adminValue = adminSnapshot.val()
  if (adminValue === true) return true
  return Boolean(adminValue && adminValue.enabled)
}

export const getAllMatchResults = async () => {
  const resultsRef = ref(db, 'matchResults')
  const snapshot = await get(resultsRef)
  if (!snapshot.exists()) return {}
  return snapshot.val() || {}
}

export const setMatchWinner = async (user, matchId, winner) => {
  if (!matchId) {
    throw new Error('Missing match id')
  }

  if (!['team1', 'team2', 'draw'].includes(winner)) {
    throw new Error('Invalid winner value')
  }

  const admin = await isAdminUser(user)
  if (!admin) {
    throw new Error('Only admins can set match winners')
  }

  const resultRef = ref(db, `matchResults/${matchId}`)
  const payload = {
    matchId,
    winner,
    setAt: new Date().toISOString(),
    setByUid: user.uid,
    setByEmail: user.email || ''
  }

  await set(resultRef, payload)
  return payload
}

export const getPredictionsForMatch = async matchId => {
  const allPredictionsRef = ref(db, 'predictions')
  const snapshot = await get(allPredictionsRef)
  if (!snapshot.exists()) return []

  const allPredictions = []
  const predictionsObj = snapshot.val()

  for (const [userId, userPredictions] of Object.entries(predictionsObj)) {
    if (!userPredictions) continue
    for (const [predictionId, prediction] of Object.entries(userPredictions)) {
      if (prediction.matchId === matchId) {
        allPredictions.push({ userId, predictionId, ...prediction })
      }
    }
  }

  return allPredictions
}

export const getPredictionStatsByMatch = async () => {
  const allPredictionsRef = ref(db, 'predictions')
  const snapshot = await get(allPredictionsRef)
  if (!snapshot.exists()) return {}

  const statsByMatch = {}
  const predictionsObj = snapshot.val() || {}

  for (const userPredictions of Object.values(predictionsObj)) {
    if (!userPredictions) continue

    for (const prediction of Object.values(userPredictions)) {
      const matchId = String(prediction?.matchId || '').trim()
      const pick = prediction?.prediction
      if (!matchId) continue
      if (!['team1', 'team2', 'draw'].includes(pick)) continue

      if (!statsByMatch[matchId]) {
        statsByMatch[matchId] = {
          team1: 0,
          draw: 0,
          team2: 0,
          total: 0
        }
      }

      statsByMatch[matchId][pick] += 1
      statsByMatch[matchId].total += 1
    }
  }

  return statsByMatch
}

export const getLeaderboard = async () => {
  const [
    predictionsSnapshot,
    resultsSnapshot,
    usersSnapshot,
    winnerBetsSnapshot
  ] = await Promise.all([
    get(ref(db, 'predictions')),
    get(ref(db, 'matchResults')),
    get(ref(db, 'users')),
    get(ref(db, 'tournamentWinnerBets'))
  ])

  if (!predictionsSnapshot.exists()) return []

  const predictionsByUser = predictionsSnapshot.val() || {}
  const resultsByMatch = resultsSnapshot.exists()
    ? resultsSnapshot.val() || {}
    : {}
  const usersByUid = usersSnapshot.exists() ? usersSnapshot.val() || {} : {}
  const winnerBetsByUid = winnerBetsSnapshot.exists()
    ? winnerBetsSnapshot.val() || {}
    : {}

  const entries = Object.entries(predictionsByUser).map(
    ([userId, userPredictions]) => {
      const predictionList = Object.values(userPredictions || {})
      let points = 0

      predictionList.forEach(prediction => {
        if (!prediction || !prediction.matchId) return
        const result = resultsByMatch[prediction.matchId]
        if (
          result &&
          result.winner &&
          result.winner === prediction.prediction
        ) {
          points += 1
        }
      })

      const email = usersByUid[userId]?.email || ''
      const nickname = usersByUid[userId]?.nickname || ''
      const hasPaid = usersByUid[userId]?.hasPaid === true
      const winnerTeam =
        String(winnerBetsByUid[userId]?.winnerTeam || '').trim() || ''

      return {
        userId,
        email,
        nickname,
        winnerTeam,
        hasPaid,
        bettingTotal: hasPaid ? 100 : 0,
        points,
        predictionsCount: predictionList.length,
        resolvedMatchesCount: predictionList.filter(
          prediction =>
            prediction?.matchId && resultsByMatch[prediction.matchId]?.winner
        ).length
      }
    }
  )

  return entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.predictionsCount !== a.predictionsCount) {
      return b.predictionsCount - a.predictionsCount
    }
    return String(a.email || a.userId).localeCompare(
      String(b.email || b.userId)
    )
  })
}

export const getAllUsers = async () => {
  const usersSnapshot = await get(ref(db, 'users'))
  if (!usersSnapshot.exists()) return []

  return Object.entries(usersSnapshot.val() || {}).map(([uid, profile]) => ({
    uid,
    email: profile.email || '',
    nickname: profile.nickname || '',
    hasPaid: profile.hasPaid === true,
    hasPaidWinnerBet: profile.hasPaidWinnerBet === true,
    updatedAt: profile.updatedAt || ''
  }))
}

export const setUserPaid = async (userId, paid) => {
  if (!userId) throw new Error('Missing user id')
  await update(ref(db, `users/${userId}`), { hasPaid: Boolean(paid) })
}

export const setUserWinnerBetPaid = async (userId, paid) => {
  if (!userId) throw new Error('Missing user id')
  await update(ref(db, `users/${userId}`), {
    hasPaidWinnerBet: Boolean(paid)
  })
}

export const removeRegisteredUserData = async (user, userId) => {
  if (!userId) throw new Error('Missing user id')

  const admin = await isAdminUser(user)
  if (!admin) {
    throw new Error('Only admins can remove users')
  }

  if (user?.uid && user.uid === userId) {
    throw new Error('You cannot remove your own account data')
  }

  const updates_obj = {
    [`predictions/${userId}`]: null,
    [`tournamentWinnerBets/${userId}`]: null,
    [`users/${userId}`]: null
  }

  await update(ref(db), updates_obj)

  // Best effort cleanup in case stale child keys remain.
  await Promise.all([
    remove(ref(db, `predictions/${userId}`)),
    remove(ref(db, `tournamentWinnerBets/${userId}`)),
    remove(ref(db, `users/${userId}`))
  ])
}

export const getBetLocks = async () => {
  const locksRef = ref(db, 'settings/betLocks')
  const snapshot = await get(locksRef)
  if (!snapshot.exists()) {
    return {
      matchesLockedAt: '',
      winnerLockedAt: ''
    }
  }

  const value = snapshot.val() || {}
  return {
    matchesLockedAt: String(value.matchesLockedAt || ''),
    winnerLockedAt: String(value.winnerLockedAt || '')
  }
}

export const setBetLocks = async (user, locks = {}) => {
  const admin = await isAdminUser(user)
  if (!admin) {
    throw new Error('Only admins can update lock settings')
  }

  const payload = {
    matchesLockedAt: String(locks.matchesLockedAt || '').trim(),
    winnerLockedAt: String(locks.winnerLockedAt || '').trim(),
    updatedAt: new Date().toISOString(),
    updatedByUid: user?.uid || '',
    updatedByEmail: user?.email || ''
  }

  await set(ref(db, 'settings/betLocks'), payload)
  return payload
}

export const onAuthChange = callback => {
  return onAuthStateChanged(auth, callback)
}
