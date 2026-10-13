
/* Handles email/password authentication and Google Sign-In. */

const form = document.querySelector('#auth-form');
const message = document.querySelector('#form-message');
const googleButton = document.querySelector('#google-button');

const csrfHeaders = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

// This Client ID is public; never put a client secret here.
const GOOGLE_CLIENT_ID =
  '717440040072-0uuaiidh7v7ojg5abo17idapp4aj213q.apps.googleusercontent.com';

function showMessage(text, isError = true) {
  if (!message) return;
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

  if (
    payload.password.length < 8 ||
    !/[A-Za-z]/.test(payload.password) ||
    !/\d/.test(payload.password)
  ) {
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
    if (validationMessage) {
      showMessage(validationMessage);
      return;
    }
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
      showMessage(
        result.error ||
          (response.status === 429
            ? 'Too many attempts. Wait 15 minutes before trying again.'
            : 'Cravely could not process that request. Check the server and try again.')
      );
      return;
    }

    window.location.assign('/index.html');
  } catch (error) {
    showMessage(
      'Cannot reach Cravely. Start it with "npm.cmd start" and open http://localhost:3000 (not Live Server).'
    );
  } finally {
    submitButton.disabled = false;
  }
}

if (form) {
  form.addEventListener('submit', submitAuth);
}

// Google Identity Services
async function handleGoogleCredential(response) {
  if (!response.credential) {
    showMessage('Google did not return a credential. Please try again.');
    return;
  }

  googleButton?.setAttribute('aria-busy', 'true');
  showMessage('');

  try {
    const result = await fetch('/api/auth/google', {
      method: 'POST',
      headers: csrfHeaders,
      body: JSON.stringify({ credential: response.credential }),
    });

    const data = await result.json().catch(() => ({}));

    if (!result.ok) {
      showMessage(data.error || 'Google sign-in failed. Please try again.');
      return;
    }

    window.location.assign('/index.html');
  } catch (error) {
    showMessage('Cannot reach Cravely. Check that your server is running.');
  } finally {
    googleButton?.removeAttribute('aria-busy');
  }
}

function initializeGoogleSignIn() {
  if (!googleButton) return;

  if (!window.google?.accounts?.id) {
    showMessage('Google Sign-In could not load. Check your connection and try again.');
    return;
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
  });

  window.google.accounts.id.renderButton(googleButton, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: 320,
  });
}

// Wait for the Google script to load.
window.addEventListener('load', initializeGoogleSignIn);

// Show/hide password
document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = button.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.textContent = input.type === 'password' ? 'Show' : 'Hide';
    button.setAttribute(
      'aria-label',
      input.type === 'password' ? 'Show password' : 'Hide password'
    );
  });
});

// Forgot password demo message
const forgotButton = document.querySelector('#forgot-button');

if (forgotButton) {
  forgotButton.addEventListener('click', () => {
    showMessage(
      'Password reset is a demo feature and is not available yet.',
      false
    );
  });
}
