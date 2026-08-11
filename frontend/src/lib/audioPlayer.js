/**
 * Audio Player Utility
 *
 * Handles playing notification sounds when app is in foreground
 */

class AudioPlayer {
  constructor() {
    this.sounds = {
      bell: null,
      chime: null,
    };
    this.isInitialized = false;
    this.volume = 0.7; // 70% volume
  }

  /**
   * Initialize audio files
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Preload audio files
      this.sounds.bell = new Audio('/sounds/notification-bell.mp3');
      this.sounds.chime = new Audio('/sounds/notification-chime.mp3');

      // Set volume
      this.sounds.bell.volume = this.volume;
      this.sounds.chime.volume = this.volume;

      // Preload with error handling
      await Promise.all([
        this.sounds.bell.load(),
        this.sounds.chime.load(),
      ]).catch((error) => {
        // Audio files might not exist yet - warn in console
        console.warn('⚠️ Audio files not found in /sounds/ directory');
        console.warn('ℹ️ Upload notification-bell.mp3 and notification-chime.mp3 to enable custom sounds');
        console.warn('ℹ️ See frontend/public/sounds/README.md for details');
      });

      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize audio player:', error);
    }
  }

  /**
   * Play notification sound
   * @param {string} soundType - 'bell' or 'chime'
   * @returns {Promise<boolean>} - true if played successfully
   */
  async play(soundType = 'bell') {
    // Initialize if not yet done
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sound = this.sounds[soundType];

    if (!sound) {
      console.warn(`Sound ${soundType} not found`);
      // Fallback: use browser beep
      this._playBeep();
      return false;
    }

    try {
      // Reset playback position
      sound.currentTime = 0;

      // Play
      await sound.play();
      return true;
    } catch (error) {
      // Playing might be blocked by browser autoplay policy or file not found
      console.warn('Failed to play notification sound:', error.message);

      // Fallback: use browser beep
      this._playBeep();
      return false;
    }
  }

  /**
   * Play a simple beep sound as fallback
   * Uses Web Audio API to generate a tone
   */
  _playBeep() {
    try {
      // Create AudioContext
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure beep: 800Hz tone, 200ms duration
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      // Envelope: quick fade in/out to avoid clicking
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.2);

      oscillator.start(now);
      oscillator.stop(now + 0.2);

      console.log('🔔 Played fallback beep sound');
    } catch (error) {
      console.warn('Failed to play beep:', error);
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));

    // Update all loaded sounds
    Object.values(this.sounds).forEach(sound => {
      if (sound) {
        sound.volume = this.volume;
      }
    });
  }

  /**
   * Check if audio can be played
   * (based on browser autoplay policy)
   */
  async canPlay() {
    try {
      const testAudio = new Audio();
      testAudio.volume = 0; // Muted test
      await testAudio.play();
      testAudio.pause();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Request audio permission (play silent audio to unlock)
   * Call this on user interaction to unlock audio on iOS
   */
  async requestPermission() {
    try {
      const silentAudio = new Audio();
      silentAudio.volume = 0;
      await silentAudio.play();
      silentAudio.pause();
      return true;
    } catch (error) {
      console.warn('Failed to request audio permission:', error);
      return false;
    }
  }
}

// Singleton instance
const audioPlayer = new AudioPlayer();

export default audioPlayer;

/**
 * Helper function to play notification sound
 * Automatically handles initialization
 *
 * @param {string} soundType - 'bell' or 'chime'
 * @returns {Promise<boolean>}
 */
export async function playNotificationSound(soundType = 'bell') {
  return await audioPlayer.play(soundType);
}

/**
 * Initialize audio on user interaction
 * Call this once on login or first user click
 */
export async function initializeAudio() {
  return await audioPlayer.initialize();
}

/**
 * Check if audio playback is allowed
 */
export async function checkAudioPermission() {
  return await audioPlayer.canPlay();
}
