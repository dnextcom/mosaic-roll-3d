// Generative Andalusian night music, synthesised in the browser with the Web Audio API.
// Plucked strings (guitar, oud, qanun) use Karplus-Strong: a noise burst circulating in a damped
// delay line. The ney is a breathy sine with vibrato, a filtered drone holds an E pedal, frame drums
// are rendered once into buffers, and a convolution reverb places everything in a stone courtyard.
// Melodies are composed by hand over the Andalusian cadence (Am–G–F–E) and Hijaz for bosses;
// the engine only picks variations, so it never sounds like random notes.

const RENDER_RATE = 32000;
const midiFreq = midi => 440 * 2 ** ((midi - 69) / 12);
const random = (low, high) => low + Math.random() * (high - low);
const pickOne = items => items[Math.floor(Math.random() * items.length)];

// Voicings from the bass up: root, fifth, octave, third, fifth.
const CHORDS = {
  Am: [45, 52, 57, 60, 64],
  G: [43, 50, 55, 59, 62],
  F: [41, 48, 53, 57, 60],
  E: [40, 47, 52, 56, 59],
  Dm: [38, 45, 50, 53, 57],
};
const ANDALUSIAN = ['Am', 'G', 'F', 'E'];
const PHRYGIAN = ['F', 'E', 'Dm', 'E'];
const HIJAZ = ['E', 'F', 'E', 'Dm'];

// Eighth-note arpeggios as indices into the voicing (null is a rest).
const ARPS = {
  flow: [0, 2, 3, 4, 3, 2, 3, 1],
  rise: [0, 1, 2, 3, 4, 3, 2, 1],
  broken: [0, 2, 4, 2, 3, 2, 4, 2],
  sparse: [0, null, null, null, 2, null, 3, null],
};
// Oud ostinato for the boss, one eighth-note bar per chord in E Hijaz (E F G# A B C D).
const RIFFS = {
  E: [52, 53, 56, 53, 57, 56, 53, 52],
  F: [53, 56, 57, 56, 60, 57, 56, 53],
  Dm: [50, 53, 57, 53, 56, 53, 52, 50],
};

// Ney phrases over a four-bar section: [midi, start beat, length in beats].
const PHRASES = {
  A1: [[76, 0, 1.5], [74, 1.5, .5], [72, 2, 1], [71, 3, .5], [72, 3.5, .5], [74, 4, 2], [71, 6, 1], [67, 7, 1],
    [72, 8, 1.5], [69, 9.5, .5], [77, 10, 1], [76, 11, 1], [74, 12, .5], [72, 12.5, .5], [71, 13, 1], [68, 14, 2]],
  A2: [[69, 0, .5], [72, .5, .5], [76, 1, 2], [77, 3, .5], [76, 3.5, .5], [74, 4, 1.5], [76, 5.5, .5], [74, 6, 1], [71, 7, 1],
    [72, 8, .5], [74, 8.5, .5], [72, 9, 1], [69, 10, 2], [68, 12, .5], [69, 12.5, .5], [71, 13, .5], [72, 13.5, .5], [71, 14, 2]],
  A3: [[76, 0, 1], [81, 1, 1.5], [80, 2.5, .5], [77, 3, .5], [76, 3.5, .5], [74, 4, 1], [79, 5, 1.5], [77, 6.5, .5], [76, 7, .5], [74, 7.5, .5],
    [72, 8, 1], [77, 9, 1], [76, 10, 1], [74, 11, .5], [72, 11.5, .5], [71, 12, 1], [68, 13, .5], [69, 13.5, .5], [71, 14, 2]],
  B1: [[69, 0, 1], [72, 1, 1], [77, 2, 2], [76, 4, 1.5], [74, 5.5, .5], [72, 6, .5], [71, 6.5, .5], [68, 7, 1],
    [69, 8, 1], [74, 9, 1], [77, 10, 1.5], [76, 11.5, .5], [74, 12, .5], [72, 12.5, .5], [71, 13, 1], [76, 14, 2]],
  B2: [[77, 0, 2], [76, 2, 1], [77, 3, 1], [76, 4, 2], [74, 6, 1], [72, 7, 1],
    [74, 8, 1.5], [77, 9.5, .5], [76, 10, 1], [74, 11, 1], [72, 12, .5], [71, 12.5, .5], [68, 13, 1], [71, 14, 2]],
  H1: [[64, 0, 1], [65, 1, .5], [68, 1.5, .5], [69, 2, 1], [68, 3, 1], [65, 4, 1.5], [64, 5.5, .5], [65, 6, 1], [68, 7, 1],
    [71, 8, 1], [72, 9, .5], [71, 9.5, .5], [69, 10, 1], [68, 11, 1], [69, 12, 1], [65, 13, 1], [64, 14, 2]],
  H2: [[76, 0, .5], [77, .5, .5], [80, 1, 1.5], [81, 2.5, .5], [80, 3, 1], [77, 4, 1], [76, 5, 1], [77, 6, .5], [76, 6.5, .5], [74, 7, 1],
    [72, 8, 1], [71, 9, 1], [68, 10, 1], [71, 11, 1], [69, 12, 1.5], [68, 13.5, .5], [64, 14, 2]],
};

// Frame-drum strokes per eighth note: D = dum (low), T = tek (rim), k = ghost.
const GROOVES = {
  bendir: ['D', null, null, 'k', 'D', null, 'k', null],
  maqsum: ['D', 'T', null, 'T', 'D', null, 'T', 'k'],
  baladi: ['D', 'D', null, 'T', 'D', 'k', 'T', 'k'],
};

// Song forms: four-bar sections that loop, with their arrangement.
const FORMS = {
  calm: { bpm: 76, sections: [
    { chords: ANDALUSIAN, arp: 'sparse' },
    { chords: ANDALUSIAN, arp: 'flow', melody: ['A1'] },
    { chords: ANDALUSIAN, arp: 'flow', melody: ['A2'] },
    { chords: PHRYGIAN, arp: 'rise', qanun: true, drums: true },
    { chords: PHRYGIAN, arp: 'rise', melody: ['B1', 'B2'], drums: true },
    { chords: ANDALUSIAN, arp: 'broken', melody: ['A3'], drums: true },
    { chords: ANDALUSIAN, arp: 'flow', melody: ['A2', 'A1'], qanun: true, drums: true },
    { chords: ANDALUSIAN, arp: 'sparse' },
  ] },
  boss: { bpm: 84, sections: [
    { chords: HIJAZ, riff: true },
    { chords: HIJAZ, riff: true, drums: true },
    { chords: HIJAZ, riff: true, drums: true, melody: ['H1'] },
    { chords: HIJAZ, riff: true, drums: true, melody: ['H2'], qanun: true },
  ] },
};

// Each screen mixes the same band differently.
const MOODS = {
  title: { form: 'calm', groove: 'bendir', levels: { guitar: 1, qanun: 1, ney: 1, drums: .7, drone: 1 }, melodyChance: 1 },
  play: { form: 'calm', groove: 'bendir', levels: { guitar: .85, qanun: .6, ney: .6, drums: .45, drone: .8 }, melodyChance: .6 },
  shop: { form: 'calm', groove: 'maqsum', levels: { guitar: 1, qanun: 1, ney: .8, drums: .9, drone: .6 }, melodyChance: .8 },
  boss: { form: 'boss', groove: 'baladi', levels: { guitar: .9, qanun: .7, ney: .9, drums: .85, drone: 1.15 }, melodyChance: 1 },
};

// Per instrument: base level, stereo position, reverb send and tone shaping.
const BUSES = {
  guitar: { level: .34, pan: -.18, send: .32, lowpass: 3400, body: 3 },
  qanun: { level: .45, pan: .3, send: .5, lowpass: 7000 },
  ney: { level: .11, pan: .08, send: .55, lowpass: 2800 },
  drums: { level: .2, pan: 0, send: .2, lowpass: 6000 },
  drone: { level: .022, pan: 0, send: .7, lowpass: 20000 },
};

// Plucked string rendered offline with Karplus-Strong and an allpass for exact tuning.
function stringSamples(midi, { seconds, brightness, t60, pick }) {
  const period = RENDER_RATE / midiFreq(midi);
  const delay = Math.max(2, Math.floor(period - .5));
  const fraction = period - .5 - delay;
  const allpass = (1 - fraction) / (1 + fraction);
  // Loss per pass so the note fades by 60 dB after t60 seconds.
  const loss = Math.pow(.001, period / (RENDER_RATE * t60));
  const line = new Float32Array(delay);
  const excitation = new Float32Array(delay);
  let smooth = 0;
  for (let index = 0; index < delay; index++) {
    smooth += (Math.random() * 2 - 1 - smooth) * brightness;
    excitation[index] = smooth;
  }
  // Subtracting a shifted copy imitates plucking the string away from its end.
  const shift = Math.max(1, Math.round(delay * pick));
  for (let index = 0; index < delay; index++) line[index] = excitation[index] - excitation[(index + shift) % delay];
  const length = Math.floor(RENDER_RATE * seconds);
  const out = new Float32Array(length);
  let index = 0, previous = 0, allpassIn = 0, allpassOut = 0, peak = 0;
  for (let sample = 0; sample < length; sample++) {
    const current = line[index];
    out[sample] = current;
    const averaged = loss * .5 * (current + previous);
    previous = current;
    allpassOut = allpass * averaged + allpassIn - allpass * allpassOut;
    allpassIn = averaged;
    line[index] = allpassOut;
    index = index + 1 === delay ? 0 : index + 1;
    if (sample < RENDER_RATE * .05) peak = Math.max(peak, Math.abs(current));
  }
  const gain = .8 / (peak || 1);
  const fadeIn = 48, fadeOut = Math.floor(RENDER_RATE * .08);
  for (let sample = 0; sample < length; sample++) {
    const edge = Math.min(1, sample / fadeIn, (length - sample) / fadeOut);
    out[sample] *= gain * edge;
  }
  return out;
}

// Frame drum strokes rendered offline.
function drumSamples(stroke) {
  const seconds = stroke === 'D' ? .7 : .16;
  const out = new Float32Array(Math.floor(RENDER_RATE * seconds));
  let phase = 0, noise = 0, high = 0;
  for (let sample = 0; sample < out.length; sample++) {
    const t = sample / RENDER_RATE;
    const white = Math.random() * 2 - 1;
    if (stroke === 'D') {
      // Pitch drops from a slap into the low ring of the skin.
      phase += 2 * Math.PI * (56 + 62 * Math.exp(-t / .025)) / RENDER_RATE;
      noise += (white - noise) * .08;
      out[sample] = Math.sin(phase) * Math.exp(-t / .19) * .95 + noise * Math.exp(-t / .012) * .6;
    } else {
      high = white - noise;
      noise += (white - noise) * (stroke === 'T' ? .35 : .2);
      phase += 2 * Math.PI * (stroke === 'T' ? 640 : 520) / RENDER_RATE;
      const body = Math.sin(phase) * Math.exp(-t / .028);
      out[sample] = (high * Math.exp(-t / (stroke === 'T' ? .02 : .012)) * .7 + body * .35) * (stroke === 'T' ? 1 : .45);
    }
  }
  return out;
}

// Stereo courtyard reverb: decaying noise whose tail darkens over time.
function impulse(context, seconds = 3, predelay = .025) {
  const rate = context.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  const start = Math.floor(rate * predelay);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let sample = start; sample < length; sample++) {
      const t = (sample - start) / (length - start);
      low += (Math.random() * 2 - 1 - low) * (.9 - .75 * t);
      data[sample] = low * Math.pow(1 - t, 2.4);
    }
  }
  return buffer;
}

export class Music {
  constructor(context, destination = context.destination) {
    this.context = context;
    this.running = false;
    this.mood = 'title';
    this.form = null;
    this.section = -1;
    this.bar = 0;
    this.buffers = new Map();
    this.volume = .5;

    this.master = context.createGain();
    this.master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.ratio.value = 3;
    compressor.attack.value = .02;
    compressor.release.value = .3;
    this.master.connect(compressor).connect(destination);
    this.reverb = context.createConvolver();
    this.reverb.buffer = impulse(context);
    this.reverb.connect(this.master);

    this.buses = {};
    for (const [name, settings] of Object.entries(BUSES)) {
      const input = context.createGain();
      let tail = input;
      if (settings.body) {
        // A soft resonance around 200 Hz gives the guitar a wooden body.
        const body = context.createBiquadFilter();
        body.type = 'peaking';
        body.frequency.value = 210;
        body.Q.value = 1.1;
        body.gain.value = settings.body;
        tail = tail.connect(body);
      }
      const tone = context.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = settings.lowpass;
      tone.Q.value = .5;
      tail = tail.connect(tone);
      const level = context.createGain();
      level.gain.value = 0;
      const pan = context.createStereoPanner();
      pan.pan.value = settings.pan;
      tail.connect(level).connect(pan);
      pan.connect(this.master);
      const send = context.createGain();
      send.gain.value = settings.send;
      pan.connect(send).connect(this.reverb);
      this.buses[name] = { input, level, base: settings.level };
    }
    this.breath = context.createBuffer(1, RENDER_RATE * 2, RENDER_RATE);
    this.breath.getChannelData(0).forEach((_, index, data) => { data[index] = Math.random() * 2 - 1; });
    this.buildDrone();
  }

  // E pedal under everything: two detuned saws and a sub sine behind a slowly breathing filter.
  buildDrone() {
    const context = this.context;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = .7;
    const sweep = context.createOscillator();
    sweep.frequency.value = .05;
    const depth = context.createGain();
    depth.gain.value = 140;
    sweep.connect(depth).connect(filter.frequency);
    filter.connect(this.buses.drone.input);
    this.droneVoices = [[40, 'sawtooth', -6, .5], [40, 'sawtooth', 7, .5], [47, 'triangle', 0, .35], [28, 'sine', 0, .9]].map(([midi, type, detune, gain]) => {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = midiFreq(midi);
      oscillator.detune.value = detune;
      const level = context.createGain();
      level.gain.value = gain;
      oscillator.connect(level).connect(filter);
      return oscillator;
    });
    this.droneParts = [sweep, ...this.droneVoices];
    this.droneStarted = false;
  }

  string(kind, midi) {
    const key = `${kind}/${midi}`;
    if (!this.buffers.has(key)) {
      const settings = kind === 'qanun' ? { seconds: 1.5, brightness: .85, t60: 1.25, pick: .09 }
        : kind === 'oud' ? { seconds: 1.4, brightness: .62, t60: 1.1, pick: .18 }
        : { seconds: 2.4, brightness: .42, t60: Math.max(1.4, 3.2 - (midi - 40) * .06), pick: .14 };
      this.buffers.set(key, this.toBuffer(stringSamples(midi, settings)));
    }
    return this.buffers.get(key);
  }

  drum(stroke) {
    const key = `drum/${stroke}`;
    if (!this.buffers.has(key)) this.buffers.set(key, this.toBuffer(drumSamples(stroke)));
    return this.buffers.get(key);
  }

  toBuffer(samples) {
    const buffer = this.context.createBuffer(1, samples.length, RENDER_RATE);
    buffer.copyToChannel(samples, 0);
    return buffer;
  }

  play(buffer, bus, time, velocity) {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = velocity;
    source.connect(gain).connect(this.buses[bus].input);
    source.start(Math.max(time, this.context.currentTime));
  }

  // Ney: a sine with a touch of triangle, breath noise, a short scoop into the pitch and late vibrato.
  ney(midi, time, length, velocity) {
    const context = this.context;
    const frequency = midiFreq(midi);
    const end = time + length;
    const legato = this.lastNey && Math.abs(this.lastNey.end - time) < .06;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(velocity, time + (legato ? .04 : .12));
    envelope.gain.setTargetAtTime(velocity * .8, time + .15, .4);
    envelope.gain.setTargetAtTime(0, end - .05, .09);
    envelope.connect(this.buses.ney.input);
    const tone = context.createOscillator();
    const edge = context.createOscillator();
    edge.type = 'triangle';
    const edgeLevel = context.createGain();
    edgeLevel.gain.value = .18;
    const from = legato ? midiFreq(this.lastNey.midi) : frequency * .97;
    for (const oscillator of [tone, edge]) {
      oscillator.frequency.setValueAtTime(from, time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, time + (legato ? .07 : .09));
    }
    if (length > .45) {
      const vibrato = context.createOscillator();
      vibrato.frequency.value = random(4.8, 5.6);
      const depth = context.createGain();
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(frequency * .007, time + Math.min(.6, length * .6));
      vibrato.connect(depth);
      depth.connect(tone.frequency);
      depth.connect(edge.frequency);
      vibrato.start(time);
      vibrato.stop(end + .4);
    }
    tone.connect(envelope);
    edge.connect(edgeLevel).connect(envelope);
    const breath = context.createBufferSource();
    breath.buffer = this.breath;
    breath.loop = true;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = frequency * 2;
    band.Q.value = 2.5;
    const breathLevel = context.createGain();
    breathLevel.gain.value = .22;
    breath.connect(band).connect(breathLevel).connect(envelope);
    for (const source of [tone, edge, breath]) {
      source.start(time);
      source.stop(end + .4);
    }
    this.lastNey = { midi, end };
  }

  setMood(mood) {
    if (!MOODS[mood]) return;
    this.mood = mood;
    if (!this.running) return;
    const now = this.context.currentTime;
    for (const [name, bus] of Object.entries(this.buses)) bus.level.gain.setTargetAtTime(bus.base * MOODS[mood].levels[name], now, 1.2);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const now = this.context.currentTime;
    if (!this.droneStarted) {
      for (const part of this.droneParts) part.start(now);
      this.droneStarted = true;
    }
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.volume, now, .8);
    this.next = Math.max(this.next ?? 0, now + .1);
    this.setMood(this.mood);
    this.tick();
    this.timer = setInterval(() => this.tick(), 200);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, .35);
    // Notes already scheduled fade with the master; the next start begins a fresh section.
    this.next = now + 1.5;
    this.section = -1;
    this.bar = 0;
  }

  tick() {
    // Whole bars are scheduled about a bar ahead, which also survives throttled timers.
    while (this.running && this.next < this.context.currentTime + 1.2) this.next += this.scheduleBar(this.next);
  }

  // Schedules one bar starting at `time` and returns its length in seconds.
  scheduleBar(time) {
    const mood = MOODS[this.mood];
    if (this.bar === 0) {
      // A new mood takes over at a section boundary so phrases are never cut in half.
      if (this.form !== mood.form) { this.form = mood.form; this.section = 0; }
      else this.section = (this.section + 1) % FORMS[this.form].sections.length;
      const section = FORMS[this.form].sections[this.section];
      this.current = {
        ...section,
        phrase: section.melody && Math.random() < mood.melodyChance ? pickOne(section.melody) : null,
        arp: section.arp === 'sparse' || Math.random() < .6 ? section.arp : pickOne(['flow', 'rise', 'broken']),
        groove: section.drums ? (this.form === 'boss' ? 'baladi' : mood.groove) : null,
      };
    }
    const section = this.current;
    const beat = 60 / FORMS[this.form].bpm;
    const eighth = beat / 2;
    const name = section.chords[this.bar];
    const chord = CHORDS[name];
    const swing = step => step % 2 ? eighth * .06 : 0;
    const human = () => random(-.006, .006);

    // Strings: guitar arpeggio, or the oud riff for the boss.
    const pattern = section.riff ? RIFFS[name] : ARPS[section.arp];
    pattern.forEach((entry, step) => {
      if (entry == null) return;
      const midi = section.riff ? entry : chord[entry];
      const accent = step === 0 ? .95 : step === 4 ? .75 : random(.48, .62);
      this.play(this.string(section.riff ? 'oud' : 'guitar', midi), 'guitar', time + step * eighth + swing(step) + human(), accent);
    });
    if (section.riff) this.play(this.string('guitar', chord[0]), 'guitar', time, .8);

    // Qanun shimmer: a rising sixteenth-note run over the second half of the bar.
    if (section.qanun) {
      const run = [chord[2] + 12, chord[3] + 12, chord[4] + 12, chord[2] + 24, chord[4] + 12, chord[3] + 12, chord[4] + 12, chord[2] + 24];
      run.forEach((midi, step) => this.play(this.string('qanun', midi), 'qanun', time + 2 * beat + step * eighth / 2 + human(), .35 + step * .03));
    }

    if (section.groove) GROOVES[section.groove].forEach((stroke, step) => {
      if (stroke) this.play(this.drum(stroke), 'drums', time + step * eighth + swing(step) + human(), stroke === 'D' ? .9 : stroke === 'T' ? .55 : .3);
    });

    if (section.phrase) {
      const from = this.bar * 4;
      for (const [midi, start, length] of PHRASES[section.phrase]) {
        if (start < from || start >= from + 4) continue;
        this.ney(midi, time + (start - from) * beat + random(0, .012), length * beat * .97, .55);
      }
    }

    this.bar = (this.bar + 1) % 4;
    return 4 * beat;
  }
}
