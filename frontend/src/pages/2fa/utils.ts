// 2FA page utilities

// UI feedback utilities
export const ui = {
  showError: (message: string): void => {
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(error => error.remove());

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mt-4 text-center';
    errorDiv.textContent = message;

    const form = document.querySelector('form');
    if (form) {
      form.appendChild(errorDiv);
    }

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  },

  showSuccess: (message: string): void => {
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());

    const successDiv = document.createElement('div');
    successDiv.className = 'success-message bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg mt-4 text-center';
    successDiv.textContent = message;

    const form = document.querySelector('form');
    if (form) {
      form.appendChild(successDiv);
    }
  },
};
