// This file submits sign-in and signup forms without exposing account data in markup.
const form = document.querySelector('#auth-form');
const message = document.querySelector('#form-message');
const csrfHeaders = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

function showMessage(text, isError = true) {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
}

function validateSignup(payload) {
  if (payload.name.trim().length < 2 || payload.name.trim().length > 50) {
    return 'Name must be between 2 and 50 characters.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
    return 'Enter a valid email address.';
  }
  if (payload.password.length < 8 || !/[A-Za-z]/.test(payload.password) || !/\d/.test(payload.password)) {
    return 'Password needs at least 8 characters, a letter and a number.';
  }
  if (new TextEncoder().encode(payload.password).length > 72) {
    return 'Password is too long. Use 72 UTF-8 bytes or fewer.';
  }
  return '';
}

async function submitAuth(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  if (form.dataset.mode === 'signup') {
    const validationMessage = validateSignup(payload);
    if (validationMessage) return showMessage(validationMessage);
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showMessage('');
  try {
    const response = await fetch(`/api/auth/${form.dataset.mode}`, {
      method: 'POST',
      headers: csrfHeaders,
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return showMessage(result.error || (response.status === 429
        ? 'Too many attempts. Wait 15 minutes before trying again.'
        : 'Cravely could not process that request. Check the server and try again.'));
    }
    window.location.assign('/index.html');
  } catch (error) {
    showMessage('Cannot reach Cravely. Start it with "npm.cmd start" and open http://localhost:3000 (not Live Server).');
  } finally {
    submitButton.disabled = false;
  }
}

form.addEventListener('submit', submitAuth);
document.querySelector('#google-button').addEventListener('click', () => showMessage('Google sign-in is coming soon.', false));
document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = button.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Show' : 'Hide';
    button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
  });
});
const forgotButton = document.querySelector('#forgot-button');
if (forgotButton) forgotButton.addEventListener('click', () => showMessage('Password reset is a demo feature and is not available yet.', false));
