// Register page utilities

// API configuration
const API_BASE_URL: string = (window as any).__API_BASE__ || '/api';

// API response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        data: data,
      };
    } else {
      return {
        success: false,
        error: data.error || 'An error occurred',
      };
    }
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: 'Network error - please check if the server is running',
    };
  }
}

// Register-specific interfaces
export interface RegisterResponse {
  message: string;
  token?: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

// Register API
export const authApi = {
  async register(username: string, email: string, password: string): Promise<ApiResponse<RegisterResponse>> {
    return apiRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },
};

// Form validation
export const validation = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  password: (password: string): boolean => {
    return password.length >= 6;
  },

  username: (username: string): boolean => {
    return username.length >= 3;
  },
};

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

  setLoading: (button: HTMLButtonElement, loading: boolean): void => {
    if (loading) {
      button.disabled = true;
      button.textContent = 'Loading...';
      button.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      button.disabled = false;
      button.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  },
};
