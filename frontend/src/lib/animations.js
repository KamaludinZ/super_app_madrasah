/**
 * Animation Utilities for Super Apps MATSANDATAMA
 * Kemenag-themed micro-interactions and delight moments
 */

/**
 * Confetti Animation for Success Celebrations
 * Islamic-themed colors (green, gold)
 */
export function triggerIslamicConfetti() {
  if (typeof window === 'undefined' || !window.confetti) {
    console.warn('Confetti library not loaded');
    return;
  }

  const colors = ['#006837', '#0B7A3B', '#C8A24A', '#D4AF37', '#FFFDF7'];

  // First burst
  window.confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: colors,
    shapes: ['circle', 'square'],
    scalar: 1.2,
  });

  // Second burst (delayed)
  setTimeout(() => {
    window.confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
    });
  }, 200);

  // Third burst (delayed)
  setTimeout(() => {
    window.confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
    });
  }, 400);
}

/**
 * Gentle Celebration for Achievement Unlocks
 * More subtle than full confetti
 */
export function triggerAchievementCelebration() {
  if (typeof window === 'undefined' || !window.confetti) return;

  const colors = ['#C8A24A', '#D4AF37'];

  window.confetti({
    particleCount: 30,
    spread: 40,
    origin: { y: 0.7 },
    colors: colors,
    shapes: ['star'],
    scalar: 0.8,
    gravity: 0.5,
  });
}

/**
 * Success Toast with Animation
 * Kemenag-themed success feedback
 */
export function showSuccessToast(message, options = {}) {
  if (typeof window === 'undefined' || !window.toast) {
    console.warn('Toast library not loaded');
    return;
  }

  const { toast } = window;

  toast.success(message, {
    duration: 3000,
    className: 'bg-[#006837] text-white',
    icon: '✓',
    ...options,
  });
}

/**
 * Prayer Time Notification
 * Gentle reminder with Islamic styling
 */
export function showPrayerNotification(prayerName, time) {
  if (typeof window === 'undefined' || !window.toast) return;

  const { toast } = window;

  toast(
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-[#006837] flex items-center justify-center">
        🕌
      </div>
      <div>
        <div className="text-sm font-semibold">Waktu Sholat {prayerName}</div>
        <div className="text-xs opacity-90">Pukul {time} WIB</div>
      </div>
    </div>,
    {
      duration: 5000,
      className: 'bg-[#006837] text-white',
    }
  );
}

/**
 * Smooth Scroll with Easing
 */
export function smoothScrollTo(element, options = {}) {
  if (typeof window === 'undefined') return;

  const defaultOptions = {
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest',
    ...options,
  };

  if (typeof element === 'string') {
    const el = document.querySelector(element);
    if (el) el.scrollIntoView(defaultOptions);
  } else {
    element?.scrollIntoView(defaultOptions);
  }
}

/**
 * Card Hover Effect Animation
 * Subtle lift and shadow
 */
export const cardHoverClass = 'transition-all duration-300 hover:shadow-lg hover:-translate-y-1';

/**
 * Button Press Animation
 * Tactile feedback
 */
export const buttonPressClass = 'active:scale-95 transition-transform duration-150';

/**
 * Fade In Animation (Framer Motion)
 */
export const fadeInVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

/**
 * Stagger Children Animation (Framer Motion)
 */
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  }
};

/**
 * Loading Spinner with Islamic Pattern
 */
export const loadingSpinnerClass = 'animate-spin text-[#006837]';

/**
 * Pulse Animation for Live Indicators
 */
export const pulseClass = 'animate-pulse';

/**
 * Number Counter Animation
 * Counts up to target number
 */
export function animateCounter(element, target, duration = 1000) {
  if (typeof window === 'undefined' || !element) return;

  const start = 0;
  const increment = target / (duration / 16); // 60fps
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, 16);
}

/**
 * Progress Bar Animation
 */
export function animateProgressBar(element, targetPercentage, duration = 1000) {
  if (typeof window === 'undefined' || !element) return;

  element.style.transition = `width ${duration}ms ease-out`;
  element.style.width = `${targetPercentage}%`;
}

/**
 * Shimmer Effect (Loading)
 */
export const shimmerClass = 'animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]';

/**
 * Breath Animation (Subtle)
 * For decorative elements
 */
export const breathClass = 'animate-[breath_4s_ease-in-out_infinite]';

// Add to global CSS:
/*
@keyframes breath {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}
*/

/**
 * Entrance Animation Classes
 */
export const entranceAnimations = {
  fadeIn: 'animate-[fadeIn_0.5s_ease-out]',
  slideInUp: 'animate-[slideInUp_0.5s_ease-out]',
  slideInLeft: 'animate-[slideInLeft_0.5s_ease-out]',
  slideInRight: 'animate-[slideInRight_0.5s_ease-out]',
  zoomIn: 'animate-[zoomIn_0.5s_ease-out]',
};

/**
 * Celebration Sound (Optional)
 * Plays a subtle chime on success
 */
export function playSuccessSound() {
  if (typeof window === 'undefined') return;

  try {
    const audio = new Audio('/sounds/success.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Silent fail if autoplay blocked
    });
  } catch (e) {
    // Silent fail
  }
}
