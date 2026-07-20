const fs = require('fs');
const path = require('path');

const AUDIO_DIR = path.join(__dirname, '../public/assets/audio');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createWAV(data, sampleRate = 44100, channels = 1) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  
  const rawData = Buffer.alloc(data.length * bytesPerSample);
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    const intSample = Math.round(sample * 32767);
    rawData.writeInt16LE(intSample, i * bytesPerSample);
  }
  
  const headerSize = 44;
  const fileSize = headerSize + rawData.length;
  
  const buffer = Buffer.alloc(fileSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(rawData.length, 40);
  
  rawData.copy(buffer, 44);
  
  return buffer;
}

function generateWhiteNoise(duration, sampleRate = 44100) {
  const length = Math.floor(duration * sampleRate);
  const data = [];
  for (let i = 0; i < length; i++) {
    data.push(Math.random() * 2 - 1);
  }
  return data;
}

function generatePinkNoise(duration, sampleRate = 44100) {
  const length = Math.floor(duration * sampleRate);
  const data = [];
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.90000 * b3 + white * 0.3104856;
    b4 = 0.65000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data.push(b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362);
    b6 = white * 0.115926;
  }
  
  const max = Math.max(...data.map(Math.abs));
  return data.map(v => v / max * 0.8);
}

function generateSineWave(freq, duration, sampleRate = 44100, phase = 0) {
  const length = Math.floor(duration * sampleRate);
  const data = [];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data.push(Math.sin(2 * Math.PI * freq * t + phase));
  }
  return data;
}

function generateSquareWave(freq, duration, sampleRate = 44100) {
  const length = Math.floor(duration * sampleRate);
  const data = [];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data.push(Math.sign(Math.sin(2 * Math.PI * freq * t)));
  }
  return data;
}

function generateSawtoothWave(freq, duration, sampleRate = 44100) {
  const length = Math.floor(duration * sampleRate);
  const data = [];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data.push((2 / Math.PI) * Math.atan(Math.tan(Math.PI * freq * t)));
  }
  return data;
}

function applyEnvelope(data, attack = 0, decay = 0, sustain = 1, release = 0.1, sampleRate = 44100) {
  const attackSamples = Math.floor(attack * sampleRate);
  const decaySamples = Math.floor(decay * sampleRate);
  const releaseSamples = Math.floor(release * sampleRate);
  const sustainSamples = data.length - attackSamples - decaySamples - releaseSamples;
  
  for (let i = 0; i < data.length; i++) {
    let envelope;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      envelope = 1 - (1 - sustain) * (i - attackSamples) / decaySamples;
    } else if (i < attackSamples + decaySamples + sustainSamples) {
      envelope = sustain;
    } else {
      envelope = sustain * (1 - (i - (attackSamples + decaySamples + sustainSamples)) / releaseSamples);
    }
    data[i] *= envelope;
  }
  
  return data;
}

function applyLowPassFilter(data, cutoff, sampleRate = 44100) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  
  let output = 0;
  return data.map(input => {
    output = output + alpha * (input - output);
    return output;
  });
}

function mixSignals(signals, weights) {
  const length = Math.max(...signals.map(s => s.length));
  const result = new Array(length).fill(0);
  
  signals.forEach((signal, i) => {
    const weight = weights[i] || 1;
    for (let j = 0; j < signal.length; j++) {
      result[j] += signal[j] * weight;
    }
  });
  
  const max = Math.max(...result.map(Math.abs));
  return result.map(v => v / max);
}

function generateLaserSound() {
  const sampleRate = 44100;
  const duration = 0.15;
  
  const noise = generateWhiteNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 8000, sampleRate);
  
  const sine = generateSineWave(2000, duration, sampleRate);
  const mixed = mixSignals([filtered, sine], [0.6, 0.4]);
  
  return applyEnvelope(mixed, 0.01, 0.02, 0.8, 0.1, sampleRate);
}

function generateMissileSound() {
  const sampleRate = 44100;
  const duration = 0.8;
  
  const noise = generateWhiteNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 3000, sampleRate);
  
  const sine1 = generateSineWave(150, duration, sampleRate);
  const sine2 = generateSineWave(300, duration, sampleRate);
  
  const mixed = mixSignals([filtered, sine1, sine2], [0.5, 0.3, 0.2]);
  return applyEnvelope(mixed, 0.1, 0.2, 0.5, 0.5, sampleRate);
}

function generateExplosionSound(duration = 0.8) {
  const sampleRate = 44100;
  
  const noise = generatePinkNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 1000, sampleRate);
  
  const lowFreq = generateSineWave(100, duration, sampleRate);
  const mixed = mixSignals([filtered, lowFreq], [0.8, 0.2]);
  
  return applyEnvelope(mixed, 0, 0.1, 0.6, duration - 0.1, sampleRate);
}

function generateShieldSound() {
  const sampleRate = 44100;
  const duration = 0.6;
  
  const noise = generateWhiteNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 5000, sampleRate);
  
  const sine = generateSineWave(880, duration, sampleRate);
  const mixed = mixSignals([filtered, sine], [0.4, 0.6]);
  
  return applyEnvelope(mixed, 0.05, 0.1, 0.7, 0.45, sampleRate);
}

function generateHealSound() {
  const sampleRate = 44100;
  const duration = 0.5;
  
  const sine1 = generateSineWave(440, duration, sampleRate);
  const sine2 = generateSineWave(554, duration, sampleRate);
  const sine3 = generateSineWave(659, duration, sampleRate);
  
  const mixed = mixSignals([sine1, sine2, sine3], [0.5, 0.3, 0.2]);
  return applyEnvelope(mixed, 0.05, 0.1, 0.8, 0.35, sampleRate);
}

function generatePowerupSound() {
  const sampleRate = 44100;
  const duration = 0.4;
  
  const length = Math.floor(duration * sampleRate);
  const data = [];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const freq = 440 + t * 1760;
    data.push(Math.sin(2 * Math.PI * freq * t));
  }
  
  return applyEnvelope(data, 0.02, 0.05, 0.9, 0.33, sampleRate);
}

function generateDamageSound() {
  const sampleRate = 44100;
  const duration = 0.3;
  
  const noise = generateWhiteNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 500, sampleRate);
  
  const sine = generateSquareWave(200, duration, sampleRate);
  const mixed = mixSignals([filtered, sine], [0.7, 0.3]);
  
  return applyEnvelope(mixed, 0, 0.05, 0.5, 0.25, sampleRate);
}

function generateBossRoar() {
  const sampleRate = 44100;
  const duration = 1.5;
  
  const noise = generatePinkNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 800, sampleRate);
  
  const length = Math.floor(duration * sampleRate);
  const modulated = [];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const mod = Math.sin(2 * Math.PI * 5 * t);
    modulated.push(filtered[i] * (0.7 + mod * 0.3));
  }
  
  return applyEnvelope(modulated, 0.2, 0.3, 0.8, 1.0, sampleRate);
}

function generateWaveStartSound() {
  const sampleRate = 44100;
  const duration = 0.5;
  
  const sine1 = generateSineWave(440, duration, sampleRate);
  const sine2 = generateSineWave(554, duration, sampleRate);
  const sine3 = generateSineWave(659, duration, sampleRate);
  
  const mixed = mixSignals([sine1, sine2, sine3], [0.4, 0.3, 0.3]);
  return applyEnvelope(mixed, 0.02, 0.1, 0.8, 0.38, sampleRate);
}

function generateLevelCompleteSound() {
  const sampleRate = 44100;
  const duration = 1.0;
  
  const notes = [523, 659, 784, 1047];
  const signals = notes.map((freq, i) => {
    const delay = i * 0.15;
    const d = duration - delay;
    if (d <= 0) return [];
    const data = generateSineWave(freq, d, sampleRate);
    const padded = new Array(Math.floor(delay * sampleRate)).fill(0);
    return padded.concat(data);
  });
  
  const mixed = mixSignals(signals, [0.4, 0.35, 0.2, 0.25]);
  return applyEnvelope(mixed, 0.05, 0.2, 0.7, 0.75, sampleRate);
}

function generateNukeSound() {
  const sampleRate = 44100;
  const duration = 2.5;
  
  const noise = generatePinkNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 500, sampleRate);
  
  const lowFreq = generateSineWave(50, duration, sampleRate);
  const mixed = mixSignals([filtered, lowFreq], [0.9, 0.1]);
  
  return applyEnvelope(mixed, 0.1, 0.2, 0.9, 2.2, sampleRate);
}

function generateBlackholeSound() {
  const sampleRate = 44100;
  const duration = 2.0;
  
  const noise = generatePinkNoise(duration, sampleRate);
  
  const length = Math.floor(duration * sampleRate);
  const modulated = [];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const sweep = 1000 - t * 500;
    if (sweep > 0) {
      const filtered = applyLowPassFilter([noise[i]], sweep, sampleRate);
      modulated.push(filtered[0]);
    } else {
      modulated.push(0);
    }
  }
  
  return applyEnvelope(modulated, 0.2, 0.3, 0.8, 1.5, sampleRate);
}

function generatePlasmaSound() {
  const sampleRate = 44100;
  const duration = 0.5;
  
  const noise = generateWhiteNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 4000, sampleRate);
  
  const sine = generateSineWave(1500, duration, sampleRate);
  const mixed = mixSignals([filtered, sine], [0.7, 0.3]);
  
  return applyEnvelope(mixed, 0.02, 0.05, 0.7, 0.43, sampleRate);
}

function generateShotgunSound() {
  const sampleRate = 44100;
  const duration = 0.6;
  
  const noise = generateWhiteNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 2000, sampleRate);
  
  return applyEnvelope(filtered, 0, 0.03, 0.5, 0.57, sampleRate);
}

function generateSniperSound() {
  const sampleRate = 44100;
  const duration = 0.8;
  
  const noise = generateWhiteNoise(0.1, sampleRate);
  const filtered = applyLowPassFilter(noise, 6000, sampleRate);
  
  const tail = generateWhiteNoise(0.7, sampleRate);
  const tailFiltered = applyLowPassFilter(tail, 500, sampleRate);
  
  const mixed = mixSignals([filtered, tailFiltered], [0.8, 0.3]);
  return applyEnvelope(mixed, 0, 0.02, 0.3, 0.78, sampleRate);
}

function generateTurretSound() {
  const sampleRate = 44100;
  const duration = 0.3;
  
  const noise = generateWhiteNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 5000, sampleRate);
  
  return applyEnvelope(filtered, 0.01, 0.02, 0.6, 0.27, sampleRate);
}

function generateGravitySound() {
  const sampleRate = 44100;
  const duration = 1.5;
  
  const noise = generatePinkNoise(duration, sampleRate);
  
  const length = Math.floor(duration * sampleRate);
  const modulated = [];
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const freq = 200 + t * 300;
    const filtered = applyLowPassFilter([noise[i]], freq, sampleRate);
    modulated.push(filtered[0]);
  }
  
  return applyEnvelope(modulated, 0.1, 0.2, 0.7, 1.2, sampleRate);
}

function generateClickSound() {
  const sampleRate = 44100;
  const duration = 0.08;
  
  const sine = generateSineWave(2000, duration, sampleRate);
  return applyEnvelope(sine, 0, 0.01, 0.5, 0.07, sampleRate);
}

function generateHoverSound() {
  const sampleRate = 44100;
  const duration = 0.05;
  
  const sine = generateSineWave(3000, duration, sampleRate);
  return applyEnvelope(sine, 0, 0, 1, 0.05, sampleRate);
}

function generateSelectSound() {
  const sampleRate = 44100;
  const duration = 0.12;
  
  const sine = generateSineWave(880, duration, sampleRate);
  return applyEnvelope(sine, 0.01, 0.02, 0.8, 0.09, sampleRate);
}

function generateSuccessSound() {
  const sampleRate = 44100;
  const duration = 0.4;
  
  const notes = [523, 659, 784];
  const signals = notes.map((freq, i) => {
    const delay = i * 0.08;
    const d = duration - delay;
    const data = generateSineWave(freq, d, sampleRate);
    const padded = new Array(Math.floor(delay * sampleRate)).fill(0);
    return padded.concat(data);
  });
  
  const mixed = mixSignals(signals, [0.5, 0.35, 0.15]);
  return applyEnvelope(mixed, 0.02, 0.1, 0.7, 0.28, sampleRate);
}

function generateErrorSound() {
  const sampleRate = 44100;
  const duration = 0.3;
  
  const sine1 = generateSquareWave(200, duration, sampleRate);
  const sine2 = generateSquareWave(150, duration, sampleRate);
  
  const mixed = mixSignals([sine1, sine2], [0.6, 0.4]);
  return applyEnvelope(mixed, 0.02, 0.1, 0.5, 0.18, sampleRate);
}

function generateBuySound() {
  const sampleRate = 44100;
  const duration = 0.25;
  
  const notes = [659, 880];
  const signals = notes.map((freq, i) => {
    const delay = i * 0.08;
    const d = duration - delay;
    const data = generateSineWave(freq, d, sampleRate);
    const padded = new Array(Math.floor(delay * sampleRate)).fill(0);
    return padded.concat(data);
  });
  
  const mixed = mixSignals(signals, [0.6, 0.4]);
  return applyEnvelope(mixed, 0.02, 0.05, 0.8, 0.18, sampleRate);
}

function generateLevelUpSound() {
  const sampleRate = 44100;
  const duration = 0.7;
  
  const notes = [440, 554, 659, 880, 1047];
  const signals = notes.map((freq, i) => {
    const delay = i * 0.1;
    const d = duration - delay;
    if (d <= 0) return [];
    const data = generateSineWave(freq, d, sampleRate);
    const padded = new Array(Math.floor(delay * sampleRate)).fill(0);
    return padded.concat(data);
  });
  
  const mixed = mixSignals(signals, [0.3, 0.25, 0.2, 0.15, 0.1]);
  return applyEnvelope(mixed, 0.05, 0.15, 0.7, 0.5, sampleRate);
}

function generateAchievementSound() {
  const sampleRate = 44100;
  const duration = 0.9;
  
  const notes = [523, 659, 784, 1047, 1175, 1319];
  const signals = notes.map((freq, i) => {
    const delay = i * 0.1;
    const d = duration - delay;
    if (d <= 0) return [];
    const data = generateSineWave(freq, d, sampleRate);
    const padded = new Array(Math.floor(delay * sampleRate)).fill(0);
    return padded.concat(data);
  });
  
  const mixed = mixSignals(signals, [0.25, 0.2, 0.18, 0.15, 0.12, 0.1]);
  return applyEnvelope(mixed, 0.05, 0.2, 0.8, 0.65, sampleRate);
}

function generateCountdownSound() {
  const sampleRate = 44100;
  const duration = 0.25;
  
  const sine = generateSineWave(600, duration, sampleRate);
  return applyEnvelope(sine, 0.01, 0.05, 0.6, 0.19, sampleRate);
}

function generateOpenSound() {
  const sampleRate = 44100;
  const duration = 0.2;
  
  const sine = generateSineWave(330, duration, sampleRate);
  return applyEnvelope(sine, 0.02, 0.05, 0.8, 0.13, sampleRate);
}

function generateCloseSound() {
  const sampleRate = 44100;
  const duration = 0.18;
  
  const sine = generateSineWave(294, duration, sampleRate);
  return applyEnvelope(sine, 0.01, 0.03, 0.7, 0.14, sampleRate);
}

function generateDeathSound() {
  const sampleRate = 44100;
  const duration = 1.0;
  
  const noise = generatePinkNoise(duration, sampleRate);
  const filtered = applyLowPassFilter(noise, 300, sampleRate);
  
  return applyEnvelope(filtered, 0.1, 0.2, 0.5, 0.7, sampleRate);
}

function generatePowerupSpawnSound() {
  const sampleRate = 44100;
  const duration = 0.2;
  
  const sine = generateSineWave(1100, duration, sampleRate);
  return applyEnvelope(sine, 0.02, 0.03, 0.9, 0.15, sampleRate);
}

function generateMusic(duration, sampleRate = 44100) {
  const length = Math.floor(duration * sampleRate);
  const data = [];
  
  const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    const chordIndex = Math.floor(t / 2) % scale.length;
    for (let j = 0; j < 3; j++) {
      const idx = (chordIndex + j) % scale.length;
      sample += Math.sin(2 * Math.PI * scale[idx] * t) * 0.3;
      sample += Math.sin(2 * Math.PI * scale[idx] * 2 * t) * 0.1;
    }
    
    sample *= Math.exp(-t * 0.05);
    data.push(sample);
  }
  
  const max = Math.max(...data.map(Math.abs));
  return data.map(v => v / max * 0.5);
}

function generateMenuMusic() {
  const sampleRate = 44100;
  const duration = 30;
  const length = Math.floor(duration * sampleRate);
  const data = [];
  
  const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    const bar = Math.floor(t / 4);
    const beat = Math.floor(t / 1);
    
    const baseNote = scale[(bar * 2) % scale.length];
    sample += Math.sin(2 * Math.PI * baseNote * t) * 0.2;
    sample += Math.sin(2 * Math.PI * baseNote * 2 * t) * 0.1;
    
    if (beat % 2 === 0) {
      const chordNote = scale[(bar * 2 + 2) % scale.length];
      sample += Math.sin(2 * Math.PI * chordNote * t) * 0.15;
    }
    
    const noise = (Math.random() - 0.5) * 0.02;
    sample += noise;
    
    sample *= 0.4;
    data.push(sample);
  }
  
  return data;
}

function generateGameplayMusic() {
  const sampleRate = 44100;
  const duration = 45;
  const length = Math.floor(duration * sampleRate);
  const data = [];
  
  const scale = [329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    const bar = Math.floor(t / 2);
    const noteIdx = (bar * 3) % scale.length;
    
    const note1 = scale[noteIdx];
    const note2 = scale[(noteIdx + 2) % scale.length];
    const note3 = scale[(noteIdx + 4) % scale.length];
    
    sample += Math.sin(2 * Math.PI * note1 * t) * 0.15;
    sample += Math.sin(2 * Math.PI * note2 * t) * 0.12;
    sample += Math.sin(2 * Math.PI * note3 * t) * 0.1;
    
    if (Math.floor(t * 4) % 2 === 0) {
      sample += Math.sin(2 * Math.PI * note1 * 2 * t) * 0.08;
    }
    
    const arpeggio = scale[(Math.floor(t * 8) + noteIdx) % scale.length];
    sample += Math.sin(2 * Math.PI * arpeggio * t) * 0.05;
    
    sample *= 0.35;
    data.push(sample);
  }
  
  return data;
}

function generateBossMusic() {
  const sampleRate = 44100;
  const duration = 30;
  const length = Math.floor(duration * sampleRate);
  const data = [];
  
  const scale = [196.00, 220.00, 246.94, 261.63, 293.66, 329.63];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    const bar = Math.floor(t / 1.5);
    const noteIdx = bar % scale.length;
    
    const note = scale[noteIdx];
    sample += Math.sin(2 * Math.PI * note * t) * 0.2;
    sample += Math.sin(2 * Math.PI * note * 1.5 * t) * 0.1;
    
    const bass = scale[(bar + 3) % scale.length] / 2;
    sample += Math.sin(2 * Math.PI * bass * t) * 0.15;
    
    if (Math.floor(t * 6) % 3 === 0) {
      const accent = scale[(noteIdx + 5) % scale.length];
      sample += Math.sin(2 * Math.PI * accent * t) * 0.1;
    }
    
    sample *= 0.4;
    data.push(sample);
  }
  
  return data;
}

function generateStoryMusic() {
  const sampleRate = 44100;
  const duration = 25;
  const length = Math.floor(duration * sampleRate);
  const data = [];
  
  const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    const bar = Math.floor(t / 3);
    const noteIdx = bar % scale.length;
    
    const note = scale[noteIdx];
    sample += Math.sin(2 * Math.PI * note * t) * 0.25;
    
    const harmony = scale[(noteIdx + 3) % scale.length];
    sample += Math.sin(2 * Math.PI * harmony * t) * 0.15;
    
    const pad = scale[(noteIdx + 1) % scale.length];
    sample += Math.sin(2 * Math.PI * pad * t * 0.5) * 0.1;
    
    sample *= Math.exp(-t * 0.02) * 0.4;
    data.push(sample);
  }
  
  return data;
}

function generateVictoryMusic() {
  const sampleRate = 44100;
  const duration = 15;
  const length = Math.floor(duration * sampleRate);
  const data = [];
  
  const scale = [523.25, 659.25, 783.99, 1046.50];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    for (let j = 0; j < scale.length; j++) {
      const delay = j * 0.2;
      if (t >= delay) {
        const note = scale[j];
        const envelope = Math.exp(-(t - delay) * 2);
        sample += Math.sin(2 * Math.PI * note * t) * envelope * 0.15;
      }
    }
    
    if (t > 1) {
      const melodyNote = scale[Math.floor(t * 2) % scale.length];
      sample += Math.sin(2 * Math.PI * melodyNote * t) * 0.1;
    }
    
    sample *= 0.4;
    data.push(sample);
  }
  
  return data;
}

const AUDIO_ASSETS = [
  { id: 'bgm-mainmenu', category: 'bgm', generator: generateMenuMusic, duration: 30 },
  { id: 'bgm-gameplay', category: 'bgm', generator: generateGameplayMusic, duration: 45 },
  { id: 'bgm-boss', category: 'bgm', generator: generateBossMusic, duration: 30 },
  { id: 'bgm-story', category: 'bgm', generator: generateStoryMusic, duration: 25 },
  { id: 'bgm-victory', category: 'bgm', generator: generateVictoryMusic, duration: 15 },
  
  { id: 'sfx-laser', category: 'effects', generator: generateLaserSound, duration: 0.15 },
  { id: 'sfx-missile', category: 'effects', generator: generateMissileSound, duration: 0.8 },
  { id: 'sfx-explosion', category: 'effects', generator: generateExplosionSound, duration: 0.8 },
  { id: 'sfx-shield', category: 'effects', generator: generateShieldSound, duration: 0.6 },
  { id: 'sfx-heal', category: 'effects', generator: generateHealSound, duration: 0.5 },
  { id: 'sfx-powerup', category: 'effects', generator: generatePowerupSound, duration: 0.4 },
  { id: 'sfx-damage', category: 'effects', generator: generateDamageSound, duration: 0.3 },
  { id: 'sfx-death', category: 'effects', generator: generateDeathSound, duration: 1.0 },
  { id: 'sfx-powerup-spawn', category: 'effects', generator: generatePowerupSpawnSound, duration: 0.2 },
  { id: 'sfx-boss-roar', category: 'effects', generator: generateBossRoar, duration: 1.5 },
  { id: 'sfx-wave-start', category: 'effects', generator: generateWaveStartSound, duration: 0.5 },
  { id: 'sfx-level-complete', category: 'effects', generator: generateLevelCompleteSound, duration: 1.0 },
  { id: 'sfx-nuke', category: 'effects', generator: generateNukeSound, duration: 2.5 },
  { id: 'sfx-blackhole', category: 'effects', generator: generateBlackholeSound, duration: 2.0 },
  { id: 'sfx-plasma', category: 'effects', generator: generatePlasmaSound, duration: 0.5 },
  { id: 'sfx-shotgun', category: 'effects', generator: generateShotgunSound, duration: 0.6 },
  { id: 'sfx-sniper', category: 'effects', generator: generateSniperSound, duration: 0.8 },
  { id: 'sfx-turret', category: 'effects', generator: generateTurretSound, duration: 0.3 },
  { id: 'sfx-gravity', category: 'effects', generator: generateGravitySound, duration: 1.5 },
  
  { id: 'ui-click', category: 'ui', generator: generateClickSound, duration: 0.08 },
  { id: 'ui-hover', category: 'ui', generator: generateHoverSound, duration: 0.05 },
  { id: 'ui-select', category: 'ui', generator: generateSelectSound, duration: 0.12 },
  { id: 'ui-success', category: 'ui', generator: generateSuccessSound, duration: 0.4 },
  { id: 'ui-error', category: 'ui', generator: generateErrorSound, duration: 0.3 },
  { id: 'ui-buy', category: 'ui', generator: generateBuySound, duration: 0.25 },
  { id: 'ui-levelup', category: 'ui', generator: generateLevelUpSound, duration: 0.7 },
  { id: 'ui-achievement', category: 'ui', generator: generateAchievementSound, duration: 0.9 },
  { id: 'ui-countdown', category: 'ui', generator: generateCountdownSound, duration: 0.25 },
  { id: 'ui-open', category: 'ui', generator: generateOpenSound, duration: 0.2 },
  { id: 'ui-close', category: 'ui', generator: generateCloseSound, duration: 0.18 },
];

function main() {
  console.log('========================================');
  console.log('Audio Generator');
  console.log('========================================\n');
  
  ensureDir(path.join(AUDIO_DIR, 'bgm'));
  ensureDir(path.join(AUDIO_DIR, 'effects'));
  ensureDir(path.join(AUDIO_DIR, 'ui'));
  
  let count = 0;
  let totalSize = 0;
  
  for (const asset of AUDIO_ASSETS) {
    const dir = path.join(AUDIO_DIR, asset.category);
    const filePath = path.join(dir, `${asset.id}.wav`);
    
    const data = asset.generator();
    const wav = createWAV(data);
    
    fs.writeFileSync(filePath, wav);
    
    const sizeKB = (wav.length / 1024).toFixed(2);
    totalSize += wav.length;
    
    count++;
    console.log(`✅ Generated ${asset.id}.wav (${sizeKB} KB)`);
  }
  
  console.log('\n========================================');
  console.log(`Generated ${count} audio files`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('========================================');
}

main();
