import { logIn, setUserNickname, signUp } from './firebase.js'

const loginForm = document.getElementById('loginForm')
const signupForm = document.getElementById('signupForm')
const loginEmail = document.getElementById('loginEmail')
const loginPassword = document.getElementById('loginPassword')
const loginNickname = document.getElementById('loginNickname')
const loginBtn = document.getElementById('loginBtn')
const loginError = document.getElementById('loginError')

const signupEmail = document.getElementById('signupEmail')
const signupNickname = document.getElementById('signupNickname')
const signupPassword = document.getElementById('signupPassword')
const signupPasswordConfirm = document.getElementById('signupPasswordConfirm')
const signupBtn = document.getElementById('signupBtn')
const signupError = document.getElementById('signupError')

const toggleFormBtns = document.querySelectorAll('.toggle-form-btn')

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
  const nickname = loginNickname.value.trim()

  if (!email || !password) {
    showError(loginError, 'Please fill in all fields.')
    return
  }

  try {
    loginBtn.disabled = true
    loginBtn.textContent = 'Signing in...'
    const user = await logIn(email, password)
    if (nickname) {
      await setUserNickname(user.uid, nickname)
    }
    window.location.href = 'index.html'
  } catch (error) {
    showError(loginError, error.message || 'Login failed.')
  } finally {
    loginBtn.disabled = false
    loginBtn.textContent = 'Sign In'
  }
})

signupBtn.addEventListener('click', async () => {
  clearError(signupError)
  const email = signupEmail.value.trim()
  const nickname = signupNickname.value.trim()
  const password = signupPassword.value
  const confirm = signupPasswordConfirm.value

  if (!email || !nickname || !password || !confirm) {
    showError(signupError, 'Please fill in all fields.')
    return
  }

  if (nickname.length < 2) {
    showError(signupError, 'Nickname must be at least 2 characters.')
    return
  }

  if (password !== confirm) {
    showError(signupError, 'Passwords do not match.')
    return
  }

  if (password.length < 6) {
    showError(signupError, 'Password must be at least 6 characters.')
    return
  }

  try {
    signupBtn.disabled = true
    signupBtn.textContent = 'Creating account...'
    await signUp(email, password, nickname)
    window.location.href = 'index.html'
  } catch (error) {
    showError(signupError, error.message || 'Signup failed.')
  } finally {
    signupBtn.disabled = false
    signupBtn.textContent = 'Create Account'
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
