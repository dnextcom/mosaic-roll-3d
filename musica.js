// Background soundtrack player («The vale path» by Umbría) with Web Audio API
// underwater/muffled lowpass filtering when entering the workshop (bazaar & kiln).

const TRACK_URL = './musica-umbria.mp3?v=esmaltes-16';

const MOODS = {
  title: { cutoff: 18000, q: 0.7, gain: 0.75 },
  play: { cutoff: 18000, q: 0.7, gain: 0.68 },
  boss: { cutoff: 18000, q: 0.7, gain: 0.78 },
  shop: { cutoff: 340, q: 1.6, gain: 0.55 },
};

export class Music {
  constructor(context, destination = context.destination) {
    this.context = context;
    this.volume = 0.6;
    this.mood = 'title';
    this.running = false;
    this.pauseTimer = null;

    this.audio = new Audio(TRACK_URL);
    this.audio.loop = true;
    this.audio.preload = 'auto';

    // Cascaded 24 dB/oct lowpass filters produce a smooth submerged effect in the shop and kiln.
    this.filterA = context.createBiquadFilter();
    this.filterA.type = 'lowpass';
    this.filterA.frequency.value = MOODS.title.cutoff;
    this.filterA.Q.value = MOODS.title.q;

    this.filterB = context.createBiquadFilter();
    this.filterB.type = 'lowpass';
    this.filterB.frequency.value = MOODS.title.cutoff;
    this.filterB.Q.value = 0.7;

    this.moodGain = context.createGain();
    this.moodGain.gain.value = MOODS.title.gain;

    this.master = context.createGain();
    this.master.gain.value = 0;

    this.source = context.createMediaElementSource(this.audio);
    this.source
      .connect(this.filterA)
      .connect(this.filterB)
      .connect(this.moodGain)
      .connect(this.master)
      .connect(destination);
  }

  get paused() {
    return this.audio.paused;
  }

  setMood(mood) {
    if (!MOODS[mood]) return;
    this.mood = mood;
    const settings = MOODS[mood];
    const now = this.context.currentTime;
    const timeConstant = mood === 'shop' ? 0.35 : 0.45;
    this.filterA.frequency.setTargetAtTime(settings.cutoff, now, timeConstant);
    this.filterA.Q.setTargetAtTime(settings.q, now, timeConstant);
    this.filterB.frequency.setTargetAtTime(settings.cutoff, now, timeConstant);
    this.moodGain.gain.setTargetAtTime(settings.gain, now, timeConstant);
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.running) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.volume, now, 0.08);
    }
  }

  start() {
    clearTimeout(this.pauseTimer);
    this.running = true;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.volume, now, 0.45);
    this.setMood(this.mood);
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
    }
  }

  stop() {
    if (!this.running && this.audio.paused) return;
    this.running = false;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.25);
    clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      if (!this.running && !this.audio.paused) this.audio.pause();
    }, 350);
  }
}
