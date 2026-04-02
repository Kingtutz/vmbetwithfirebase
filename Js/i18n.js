const STORAGE_KEY = 'siteLanguage'

const teamTranslations = {
  Mexiko: 'Mexico',
  Sydafrika: 'South Africa',
  Sydkorea: 'South Korea',
  Tjeckien: 'Czech Republic',
  Kanada: 'Canada',
  'Bosnien-Hercegovina': 'Bosnia and Herzegovina',
  USA: 'United States',
  Paraguay: 'Paraguay',
  Qatar: 'Qatar',
  Schweiz: 'Switzerland',
  Brasilien: 'Brazil',
  Marocko: 'Morocco',
  Haiti: 'Haiti',
  Skottland: 'Scotland',
  Australien: 'Australia',
  Turkiet: 'Turkey',
  Tyskland: 'Germany',
  Curacao: 'Curacao',
  Nederländerna: 'Netherlands',
  Japan: 'Japan',
  Elfenbenskusten: 'Ivory Coast',
  Ecuador: 'Ecuador',
  Sverige: 'Sweden',
  Tunisien: 'Tunisia',
  Spanien: 'Spain',
  'Kap Verde': 'Cape Verde',
  Belgien: 'Belgium',
  Egypten: 'Egypt',
  Saudiarabien: 'Saudi Arabia',
  Uruguay: 'Uruguay',
  Iran: 'Iran',
  'New Zealand': 'New Zealand',
  Frankrike: 'France',
  Senegal: 'Senegal',
  Irak: 'Iraq',
  Norge: 'Norway',
  Argentina: 'Argentina',
  Algeriet: 'Algeria',
  Österrike: 'Austria',
  Jordan: 'Jordan',
  Portugal: 'Portugal',
  'DR Kongo': 'DR Congo',
  England: 'England',
  Kroatien: 'Croatia',
  Ghana: 'Ghana',
  Panama: 'Panama',
  Uzbekistan: 'Uzbekistan',
  Colombia: 'Colombia'
}

const translations = {
  sv: {
    'common.language': 'Språk',
    'common.loading': 'Laddar...',
    'common.login': 'Logga in',
    'common.logout': 'Logga ut',
    'common.guest': 'Gäst',
    'common.groups': 'Grupper',
    'common.info': 'Info',
    'common.matches': 'Matcher',
    'common.winnerBet': 'VM-vinnare',
    'common.admin': 'Admin',
    'common.topList': 'Topplista',
    'common.searchRound': 'Sök omgang...',
    'common.searchTeam': 'Sök lag...',
    'common.draw': 'Oavgjort',
    'common.wins': 'vinner',
    'common.email': 'E-post',
    'common.password': 'Lösenord',
    'common.nickname': 'Smeknamn',
    'common.save': 'Spara',
    'common.user': 'Användare',
    'common.confirmPassword': 'Bekräfta lösenord',
    'common.logoutFailed': 'Utloggningen misslyckades.',
    'common.currentWinner': 'Nuvarande vinnare: {winner}',
    'common.notSet': 'Ej satt',
    'common.matchesCount': '{count} matcher',
    'common.pointsShort': 'poäng',
    'common.predictionsLabel': 'tips',
    'common.scoredLabel': 'avgjorda',

    'landing.title': 'VM 2026 Tippning',
    'landing.heroTitle': 'VM 2026 Tippning',
    'landing.heroText':
      'Tippa matchresultat, följ topplistan och tavla mot dina vanner pa ett stalle.',
    'landing.ctaLogin': 'Logga in / Skapa konto',
    'landing.ctaGroups': 'Oppna grupper',
    'landing.ctaTopList': 'Visa topplista',
    'landing.howItWorksTitle': 'Sa fungerar det',
    'landing.howItWorksText': 'Tippa varje match. Varje ratt tips ger 1 poang.',
    'landing.groupOverviewTitle': 'Gruppoversikt',
    'landing.groupOverviewText':
      'Bladdra bland alla grupper och se gruppmatcher direkt i varje gruppkort.',
    'landing.leaderboardTitle': 'Topplista',
    'landing.leaderboardText':
      'Se vem som leder med poäng baserat på matchresultat.',

    'groups.title': 'VM Grupper',
    'groups.headerTitle': 'VM Grupper',
    'groups.headerText':
      'Varje gruppkort visar nu gruppmatcher. Klicka pa ett lag for hela listan.',
    'groups.upcomingMatches': 'Kommande matcher',
    'groups.selectTeam': 'Valj ett lag for att se matcher.',
    'groups.upcomingMatchesFor': 'Kommande matcher - {team}',
    'groups.noMatchesFor': 'Inga matcher hittades for {team}.',
    'groups.groupMatches': 'Gruppmatcher',
    'groups.noGroupMatches': 'Inga gruppmatcher hittades an.',
    'groups.groupLabel': 'Grupp {group}',
    'groups.couldNotLoad': 'Kunde inte ladda grupper fran Firebase.',

    'bets.title': 'VM Matcher - Lagg tips',
    'bets.headerTitle': 'VM Matcher',
    'bets.headerText': 'Lagg dina tips for varje match.',
    'bets.myPredictions': 'Mina tips',
    'bets.predictionsAppearHere': 'Dina tips visas har.',
    'bets.noMatchesFound': 'Inga matcher hittades.',
    'bets.placeBet': 'Lagg tips ({done}/{total})',
    'bets.saving': 'Sparar...',
    'bets.noUnlockedToSave': 'Inga oppna tips att spara.',
    'bets.saveSuccess': 'Alla tips sparades!',
    'bets.saveFailed': 'Det gick inte att spara tipsen. Forsok igen.',
    'bets.noPredictionsYet': 'Du har inte gjort nagra tips an.',
    'bets.unsaved': 'Inte sparad',
    'bets.lockedResult': 'Last - resultat satt: {winner}',
    'bets.lockedByAdmin': 'Last av admin - tiden for matchtips har passerat.',
    'bets.compactOn': 'Kompakt lage: Pa',
    'bets.compactOff': 'Kompakt lage: Av',
    'bets.couldNotLoad': 'Kunde inte ladda matcher fran Firebase.',

    'winner.title': 'VM-vinnare - Tippa vinnaren',
    'winner.headerTitle': 'Tippa VM-vinnaren',
    'winner.headerText': 'Välj laget du tror vinner hela turneringen.',
    'winner.chooseWinner': 'Välj turneringsvinnare',
    'winner.currentPick': 'Ditt val: {team}',
    'winner.totalBet': 'Total vinnarpott: {amount} kr ({count} spelare)',
    'winner.noPickYet': 'Du har inte valt vinnare ännu.',
    'winner.savePick': 'Spara vinnartips',
    'winner.saving': 'Sparar...',
    'winner.saveSuccess': 'Vinnartips sparat!',
    'winner.saveFailed': 'Kunde inte spara vinnartips.',
    'winner.selectTeamFirst': 'Välj ett lag först.',
    'winner.couldNotLoad': 'Kunde inte ladda lag och ditt tips.',
    'winner.lockedByAdmin':
      'Last av admin - tiden for vinnartips har passerat.',

    'leaderboard.title': 'Topplista - Tippningspoang',
    'leaderboard.headerTitle': 'Topplista',
    'leaderboard.headerText': 'Varje ratt svar ger 1 poang.',
    'leaderboard.ranking': 'Ranking',
    'leaderboard.noPredictionsYet': 'Inga tips an.',
    'leaderboard.couldNotLoad': 'Kunde inte ladda topplistan.',
    'leaderboard.winnerPick': 'Vinnartips: {team}',
    'leaderboard.firstPrize': '1:a: {amount} kr',
    'leaderboard.secondPrize': '2:a: {amount} kr',
    'leaderboard.thirdPrize': '3:a: {amount} kr',

    'login.title': 'VM Tippning - Logga in',
    'login.signIn': 'Logga in',
    'login.signInSubtitle': 'Logga in pa ditt konto',
    'login.emailPlaceholder': 'din@email.com',
    'login.passwordPlaceholder': 'Ditt losenord',
    'login.signInButton': 'Logga in',
    'login.noAccount': 'Har du inget konto? Skapa ett',
    'login.createAccount': 'Skapa konto',
    'login.createAccountSubtitle': 'Ga med i VM-tippningen',
    'login.nicknamePlaceholder': 'Valj ett smeknamn',
    'login.passwordMin': 'Minst 6 tecken',
    'login.confirmPasswordPlaceholder': 'Bekrafta losenord',
    'login.haveAccount': 'Har du redan ett konto? Logga in',
    'login.fillAllFields': 'Fyll i alla falt.',
    'login.nicknameTooShort': 'Smeknamnet maste vara minst 2 tecken.',
    'login.passwordsNoMatch': 'Losenorden matchar inte.',
    'login.passwordTooShort': 'Losenordet maste vara minst 6 tecken.',
    'login.signingIn': 'Loggar in...',
    'login.signingInGoogle': 'Loggar in med Google...',
    'login.loginFailed': 'Inloggningen misslyckades.',
    'login.creatingAccount': 'Skapar konto...',
    'login.signupFailed': 'Registreringen misslyckades.',
    'login.createAccountButton': 'Skapa konto',
    'login.googleButton': 'Fortsatt med Google',

    'admin.title': 'Admin - Satt matchvinnare',
    'admin.headerTitle': 'Adminpanel',
    'admin.headerText': 'Bestam vinnaren i varje match.',
    'admin.apiSyncTitle': 'API-FOOTBALL live-sync',
    'admin.apiSyncSubtitle':
      'Lagg till din API-nyckel och synka avslutade VM-matcher automatiskt.',
    'admin.apiKeyPlaceholder': 'API-FOOTBALL-nyckel',
    'admin.saveKey': 'Spara nyckel',
    'admin.syncLive': 'Synka livescore',
    'admin.registeredUsers': 'Registrerade anvandare',
    'admin.totalBet': 'Total insats: {amount} kr',
    'admin.noUsers': 'Inga registrerade anvandare hittades.',
    'admin.paid': 'Betald',
    'admin.unpaid': 'Obetald',
    'admin.markPaid': 'Markera som betald',
    'admin.markUnpaid': 'Markera som obetald',
    'admin.matchBetLabel': 'Matchbet',
    'admin.winnerBetLabel': 'Vinnarbet',
    'admin.markWinnerPaid': 'Markera vinnarbet som betald',
    'admin.markWinnerUnpaid': 'Markera vinnarbet som obetald',
    'admin.matchPayoutSummary':
      'Matchpott: {total} kr, 1:a (65%): {first} kr, 2:a (15%): {second} kr, 3:a (10%): {third} kr, kvar: {rest} kr.',
    'admin.noMatchesFound': 'Inga matcher hittades.',
    'admin.notAdmin': 'Du ar inloggad, men det har kontot ar inte admin.',
    'admin.couldNotSaveWinner': 'Kunde inte spara matchvinnare.',
    'admin.couldNotUpdatePayment': 'Kunde inte uppdatera betalstatus.',
    'admin.couldNotLoadPage': 'Kunde inte ladda adminsidan.',
    'admin.addSaveKeyFirst': 'Lagg till och spara en API-nyckel forst.',
    'admin.syncing': 'Synkar avslutade VM-matcher...',
    'admin.syncFailed': 'Live-sync misslyckades.',
    'admin.apiRequestFailed':
      'API-FOOTBALL-anropet misslyckades. Kontrollera din API-nyckel.',
    'admin.apiKeyEmpty': 'API-nyckeln kan inte vara tom.',
    'admin.apiKeySaved': 'API-nyckeln sparades i den har webblasaren.',
    'admin.syncComplete':
      'Synk klar. Uppdaterade {updated} match(er). Hoppade over {skipped} omatchade fixture(s).',
    'admin.compactOn': 'Kompakt lage: Pa',
    'admin.compactOff': 'Kompakt lage: Av',
    'admin.lockSettingsTitle': 'Lasningsinstallningar for bets',
    'admin.lockSettingsSubtitle':
      'Ange nar anvandare inte langre far lagga eller andra bets.',
    'admin.matchesLockAt': 'Las matchtips vid',
    'admin.winnerLockAt': 'Las vinnartips vid',
    'admin.saveLocks': 'Spara lasningar',
    'admin.clearLocks': 'Rensa lasningar',
    'admin.locksSaved': 'Lasningsinstallningarna sparades.',
    'admin.locksCleared': 'Alla lasningar rensades.',
    'admin.couldNotSaveLocks': 'Kunde inte spara lasningarna.',
    'admin.winnerResultTitle': 'Turneringsvinnare (resultat)',
    'admin.winnerResultSubtitle':
      'Valj vinnaren for att rakna ut utbetalning for korrekta vinnartips.',
    'admin.selectWinnerResult': 'Valj turneringsvinnare',
    'admin.saveWinnerResult': 'Spara vinnare',
    'admin.selectWinnerResultFirst': 'Valj en vinnare forst.',
    'admin.winnerResultSaved': 'Turneringsvinnaren sparades.',
    'admin.couldNotSaveWinnerResult': 'Kunde inte spara turneringsvinnaren.',
    'admin.winnerPayoutSummary':
      'Vinnarpott: {total} kr, 90% att dela: {pool90} kr, korrekta betalande tips: {winners}, utbetalning per vinnare: {payout} kr.',
    'admin.winnerPayoutBreakdown': 'Utbetalning per korrekt anvandare',
    'admin.winnerPayoutNoWinners':
      'Ingen betalande anvandare har ratt vinnartips an.',
    'admin.payoutEach': '{amount} kr',

    'nickname.prompt': 'Ange ditt smeknamn',
    'nickname.empty': 'Smeknamnet kan inte vara tomt.',
    'nickname.updateFailed': 'Kunde inte uppdatera smeknamnet.',
    'nickname.clickToChange': 'Klicka for att andra smeknamn',
    'nickname.loginToSet': 'Logga in for att satta ett smeknamn'
  },
  en: {
    'common.language': 'Language',
    'common.loading': 'Loading...',
    'common.login': 'Login',
    'common.logout': 'Logout',
    'common.guest': 'Guest',
    'common.groups': 'Groups',
    'common.info': 'Info',
    'common.matches': 'Matches',
    'common.winnerBet': 'Winner Bet',
    'common.admin': 'Admin',
    'common.topList': 'Top List',
    'common.searchRound': 'Search round...',
    'common.searchTeam': 'Search team...',
    'common.draw': 'Draw',
    'common.wins': 'wins',
    'common.email': 'Email',
    'common.password': 'Password',
    'common.nickname': 'Nickname',
    'common.save': 'Save',
    'common.user': 'User',
    'common.confirmPassword': 'Confirm password',
    'common.logoutFailed': 'Logout failed.',
    'common.currentWinner': 'Current winner: {winner}',
    'common.notSet': 'Not set',
    'common.matchesCount': '{count} matches',
    'common.pointsShort': 'pts',
    'common.predictionsLabel': 'predictions',
    'common.scoredLabel': 'scored',

    'landing.title': 'World Cup 2026 Betting',
    'landing.heroTitle': 'World Cup 2026 Betting',
    'landing.heroText':
      'Predict match outcomes, follow the top list, and compete with your friends in one place.',
    'landing.ctaLogin': 'Login / Sign Up',
    'landing.ctaGroups': 'Open Groups',
    'landing.ctaTopList': 'View Top List',
    'landing.howItWorksTitle': 'How It Works',
    'landing.howItWorksText':
      'Make predictions for each match. Every correct prediction gives 1 point.',
    'landing.groupOverviewTitle': 'Group Overview',
    'landing.groupOverviewText':
      'Browse all tournament groups and see group matches directly inside each group card.',
    'landing.leaderboardTitle': 'Leaderboard',
    'landing.leaderboardText':
      'Track who is leading with points based on admin-confirmed match results.',

    'groups.title': 'World Cup Groups',
    'groups.headerTitle': 'World Cup Groups',
    'groups.headerText':
      'Each group card now shows its group matches. Click a team for the full list.',
    'groups.upcomingMatches': 'Upcoming Matches',
    'groups.selectTeam': 'Select a team to view matches.',
    'groups.upcomingMatchesFor': 'Upcoming Matches - {team}',
    'groups.noMatchesFor': 'No matches found for {team}.',
    'groups.groupMatches': 'Group Matches',
    'groups.noGroupMatches': 'No group matches found yet.',
    'groups.groupLabel': 'Group {group}',
    'groups.couldNotLoad': 'Could not load groups from Firebase.',

    'bets.title': 'World Cup Matches - Make Predictions',
    'bets.headerTitle': 'World Cup Matches',
    'bets.headerText': 'Make your predictions for every match.',
    'bets.myPredictions': 'My Predictions',
    'bets.predictionsAppearHere': 'Your predictions will appear here.',
    'bets.noMatchesFound': 'No matches found.',
    'bets.placeBet': 'Place Bet ({done}/{total})',
    'bets.saving': 'Saving...',
    'bets.noUnlockedToSave': 'No unlocked predictions to save.',
    'bets.saveSuccess': 'All predictions saved successfully!',
    'bets.saveFailed': 'Failed to save predictions. Please try again.',
    'bets.noPredictionsYet': "You haven't made any predictions yet.",
    'bets.unsaved': 'Unsaved',
    'bets.lockedResult': 'Locked - result set: {winner}',
    'bets.lockedByAdmin':
      'Locked by admin - match betting deadline has passed.',
    'bets.compactOn': 'Compact Mode: On',
    'bets.compactOff': 'Compact Mode: Off',
    'bets.couldNotLoad': 'Could not load matches from Firebase.',

    'winner.title': 'World Cup Winner - Place Winner Bet',
    'winner.headerTitle': 'Bet on the World Cup Winner',
    'winner.headerText': 'Pick the team you believe will win the tournament.',
    'winner.chooseWinner': 'Choose tournament winner',
    'winner.currentPick': 'Your pick: {team}',
    'winner.totalBet': 'Total winner pool: {amount} kr ({count} players)',
    'winner.noPickYet': "You haven't picked a winner yet.",
    'winner.savePick': 'Save winner pick',
    'winner.saving': 'Saving...',
    'winner.saveSuccess': 'Winner pick saved!',
    'winner.saveFailed': 'Could not save winner pick.',
    'winner.selectTeamFirst': 'Select a team first.',
    'winner.couldNotLoad': 'Could not load teams and your pick.',
    'winner.lockedByAdmin':
      'Locked by admin - winner betting deadline has passed.',

    'leaderboard.title': 'Top List - Prediction Scores',
    'leaderboard.headerTitle': 'Top List',
    'leaderboard.headerText': 'Each correct answer gives 1 point.',
    'leaderboard.ranking': 'Ranking',
    'leaderboard.noPredictionsYet': 'No predictions yet.',
    'leaderboard.couldNotLoad': 'Could not load leaderboard.',
    'leaderboard.winnerPick': 'Winner pick: {team}',
    'leaderboard.firstPrize': '1st: {amount} kr',
    'leaderboard.secondPrize': '2nd: {amount} kr',
    'leaderboard.thirdPrize': '3rd: {amount} kr',

    'login.title': 'World Cup Betting - Login',
    'login.signIn': 'Login',
    'login.signInSubtitle': 'Sign in to your account',
    'login.emailPlaceholder': 'your@email.com',
    'login.passwordPlaceholder': 'Your password',
    'login.signInButton': 'Sign In',
    'login.noAccount': "Don't have an account? Sign up",
    'login.createAccount': 'Create Account',
    'login.createAccountSubtitle': 'Join the world cup betting',
    'login.nicknamePlaceholder': 'Pick a nickname',
    'login.passwordMin': 'Min. 6 characters',
    'login.confirmPasswordPlaceholder': 'Confirm password',
    'login.haveAccount': 'Already have an account? Sign in',
    'login.fillAllFields': 'Please fill in all fields.',
    'login.nicknameTooShort': 'Nickname must be at least 2 characters.',
    'login.passwordsNoMatch': 'Passwords do not match.',
    'login.passwordTooShort': 'Password must be at least 6 characters.',
    'login.signingIn': 'Signing in...',
    'login.signingInGoogle': 'Signing in with Google...',
    'login.loginFailed': 'Login failed.',
    'login.creatingAccount': 'Creating account...',
    'login.signupFailed': 'Signup failed.',
    'login.createAccountButton': 'Create Account',
    'login.googleButton': 'Continue with Google',

    'admin.title': 'Admin - Set Match Winners',
    'admin.headerTitle': 'Admin Panel',
    'admin.headerText': 'Designate the winner for each match.',
    'admin.apiSyncTitle': 'API-FOOTBALL Live Sync',
    'admin.apiSyncSubtitle':
      'Add your API key and sync finished World Cup matches automatically.',
    'admin.apiKeyPlaceholder': 'API-FOOTBALL key',
    'admin.saveKey': 'Save key',
    'admin.syncLive': 'Sync live scores',
    'admin.registeredUsers': 'Registered Users',
    'admin.totalBet': 'Total bet: {amount} kr',
    'admin.noUsers': 'No registered users found.',
    'admin.paid': 'Paid',
    'admin.unpaid': 'Unpaid',
    'admin.markPaid': 'Mark as Paid',
    'admin.markUnpaid': 'Mark as Unpaid',
    'admin.matchBetLabel': 'Match bet',
    'admin.winnerBetLabel': 'Winner bet',
    'admin.markWinnerPaid': 'Mark winner bet as Paid',
    'admin.markWinnerUnpaid': 'Mark winner bet as Unpaid',
    'admin.matchPayoutSummary':
      'Match pool: {total} kr, 1st (65%): {first} kr, 2nd (15%): {second} kr, 3rd (10%): {third} kr, remaining: {rest} kr.',
    'admin.noMatchesFound': 'No matches found.',
    'admin.notAdmin': 'You are logged in, but this account is not an admin.',
    'admin.couldNotSaveWinner': 'Could not save match winner.',
    'admin.couldNotUpdatePayment': 'Could not update payment status.',
    'admin.couldNotLoadPage': 'Could not load admin page.',
    'admin.addSaveKeyFirst': 'Add and save an API key first.',
    'admin.syncing': 'Syncing finished World Cup fixtures...',
    'admin.syncFailed': 'Live sync failed.',
    'admin.apiRequestFailed':
      'API-FOOTBALL request failed. Check your API key.',
    'admin.apiKeyEmpty': 'API key cannot be empty.',
    'admin.apiKeySaved': 'API key saved in this browser.',
    'admin.syncComplete':
      'Sync complete. Updated {updated} match(es). Skipped {skipped} unmatched fixture(s).',
    'admin.compactOn': 'Compact Mode: On',
    'admin.compactOff': 'Compact Mode: Off',
    'admin.lockSettingsTitle': 'Bet lock settings',
    'admin.lockSettingsSubtitle':
      'Set when users can no longer place or update bets.',
    'admin.matchesLockAt': 'Lock match bets at',
    'admin.winnerLockAt': 'Lock winner bets at',
    'admin.saveLocks': 'Save lock settings',
    'admin.clearLocks': 'Clear locks',
    'admin.locksSaved': 'Lock settings saved.',
    'admin.locksCleared': 'All lock settings were cleared.',
    'admin.couldNotSaveLocks': 'Could not save lock settings.',
    'admin.winnerResultTitle': 'Tournament winner result',
    'admin.winnerResultSubtitle':
      'Select the winner to calculate payout for correct winner bets.',
    'admin.selectWinnerResult': 'Select tournament winner',
    'admin.saveWinnerResult': 'Save winner result',
    'admin.selectWinnerResultFirst': 'Select a winner first.',
    'admin.winnerResultSaved': 'Tournament winner saved.',
    'admin.couldNotSaveWinnerResult':
      'Could not save tournament winner result.',
    'admin.winnerPayoutSummary':
      'Winner pool: {total} kr, 90% distributable: {pool90} kr, correct paid picks: {winners}, payout per winner: {payout} kr.',
    'admin.winnerPayoutBreakdown': 'Payout per correct user',
    'admin.winnerPayoutNoWinners':
      'No paid users have the correct winner pick yet.',
    'admin.payoutEach': '{amount} kr',

    'nickname.prompt': 'Enter your nickname',
    'nickname.empty': 'Nickname cannot be empty.',
    'nickname.updateFailed': 'Could not update nickname.',
    'nickname.clickToChange': 'Click to change nickname',
    'nickname.loginToSet': 'Log in to set a nickname'
  }
}

let currentLanguage = window.localStorage.getItem(STORAGE_KEY) || 'sv'
const listeners = new Set()
let initialized = false

const interpolate = (template, variables = {}) =>
  String(template).replace(/\{(\w+)\}/g, (_, key) =>
    variables[key] == null ? '' : String(variables[key])
  )

export const getLanguage = () => currentLanguage

export const t = (key, variables = {}) => {
  const table = translations[currentLanguage] || translations.sv
  const fallback = translations.en[key] || translations.sv[key] || key
  return interpolate(table[key] || fallback, variables)
}

export const translateTeamName = teamName => {
  if (currentLanguage === 'sv') return teamName
  return teamTranslations[teamName] || teamName
}

const translateDocument = () => {
  document.documentElement.lang = currentLanguage

  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n)
  })

  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    element.placeholder = t(element.dataset.i18nPlaceholder)
  })

  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    element.title = t(element.dataset.i18nTitle)
  })
}

const createLanguageSwitcher = () => {
  if (document.querySelector('.language-switcher')) return

  const wrapper = document.createElement('div')
  wrapper.className = 'language-switcher'

  const label = document.createElement('label')
  label.className = 'language-label'
  label.textContent = t('common.language')

  const select = document.createElement('select')
  select.className = 'language-select'
  select.innerHTML = `
    <option value="sv">Svenska</option>
    <option value="en">English</option>
  `
  select.value = currentLanguage
  select.addEventListener('change', event => {
    setLanguage(event.target.value)
  })

  wrapper.appendChild(label)
  wrapper.appendChild(select)

  const userInfo = document.querySelector('.user-info')
  if (userInfo) {
    userInfo.prepend(wrapper)
  } else {
    wrapper.classList.add('floating')
    document.body.appendChild(wrapper)
  }
}

const updateSwitcher = () => {
  const label = document.querySelector('.language-label')
  const select = document.querySelector('.language-select')
  if (label) label.textContent = t('common.language')
  if (select) select.value = currentLanguage
}

export const setLanguage = language => {
  currentLanguage = language === 'en' ? 'en' : 'sv'
  window.localStorage.setItem(STORAGE_KEY, currentLanguage)
  translateDocument()
  updateSwitcher()
  listeners.forEach(listener => listener(currentLanguage))
}

export const onLanguageChange = listener => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const initI18n = () => {
  if (!initialized) {
    createLanguageSwitcher()
    initialized = true
  }

  translateDocument()
  updateSwitcher()
}
