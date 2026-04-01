import { logIn, signUp } from './firebase.js'
import { initI18n, t } from './i18n.js'

const loginForm = document.getElementById('loginForm')
const signupForm = document.getElementById('signupForm')
const loginEmail = document.getElementById('loginEmail')
const loginPassword = document.getElementById('loginPassword')
const loginBtn = document.getElementById('loginBtn')
const loginError = document.getElementById('loginError')

const signupEmail = document.getElementById('signupEmail')
const signupNickname = document.getElementById('signupNickname')
const signupPassword = document.getElementById('signupPassword')
const signupPasswordConfirm = document.getElementById('signupPasswordConfirm')
const signupBtn = document.getElementById('signupBtn')
const signupError = document.getElementById('signupError')

initI18n()

const showError = (element, message) => {
  element.textContent = message
  element.classList.add('show')
}

const clearError = element => {
  element.textContent = ''
  element.classList.remove('show')
}

const switchToSignup = () => {
  loginForm.style.display = 'none'
  signupForm.style.display = 'block'
}

const switchToLogin = () => {
  signupForm.style.display = 'none'
  loginForm.style.display = 'block'
}

loginBtn.addEventListener('click', async () => {
  clearError(loginError)
  const email = loginEmail.value.trim()
  const password = loginPassword.value

  if (!email || !password) {
    showError(loginError, t('login.fillAllFields'))
    return
  }

  try {
    loginBtn.disabled = true
    loginBtn.textContent = t('login.signingIn')
    await logIn(email, password)
    window.location.href = 'groups.html'
  } catch (error) {
    showError(loginError, error.message || t('login.loginFailed'))
  } finally {
    loginBtn.disabled = false
    loginBtn.textContent = t('login.signInButton')
  }
})

signupBtn.addEventListener('click', async () => {
  clearError(signupError)
  const email = signupEmail.value.trim()
  const nickname = signupNickname.value.trim()
  const password = signupPassword.value
  const confirm = signupPasswordConfirm.value

  if (!email || !nickname || !password || !confirm) {
    showError(signupError, t('login.fillAllFields'))
    return
  }

  if (nickname.length < 2) {
    showError(signupError, t('login.nicknameTooShort'))
    return
  }

  if (password !== confirm) {
    showError(signupError, t('login.passwordsNoMatch'))
    return
  }

  if (password.length < 6) {
    showError(signupError, t('login.passwordTooShort'))
    return
  }

  try {
    signupBtn.disabled = true
    signupBtn.textContent = t('login.creatingAccount')
    await signUp(email, password, nickname)
    window.location.href = 'groups.html'
  } catch (error) {
    showError(signupError, error.message || t('login.signupFailed'))
  } finally {
    signupBtn.disabled = false
    signupBtn.textContent = t('login.createAccountButton')
  }
})

loginPassword.addEventListener('keypress', e => {
  if (e.key === 'Enter') loginBtn.click()
})

signupPasswordConfirm.addEventListener('keypress', e => {
  if (e.key === 'Enter') signupBtn.click()
})

// Form toggle buttons
document.querySelectorAll('.toggle-to-signup').forEach(btn => {
  btn.addEventListener('click', switchToSignup)
})

document.querySelectorAll('.toggle-to-login').forEach(btn => {
  btn.addEventListener('click', switchToLogin)
})
