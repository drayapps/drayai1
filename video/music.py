import numpy as np, wave, struct, sys

DUR = 70.9
SR = 44100
N = int(DUR * SR)
t = np.arange(N) / SR
out = np.zeros(N)

# Am - F - C - G progression, calm and warm. 8s per chord.
chords = {
    'Am': [220.00, 261.63, 329.63],   # A3 C4 E4
    'F':  [174.61, 220.00, 261.63],   # F3 A3 C4
    'C':  [196.00, 261.63, 329.63],   # G3 C4 E4 (C add)
    'G':  [196.00, 246.94, 293.66],   # G3 B3 D4
}
seq = ['Am', 'F', 'C', 'G']
CHORD = 8.0

def adsr(length, attack=1.5, release=2.0):
    env = np.ones(length)
    a = int(attack * SR); r = int(release * SR)
    if a > 0: env[:a] = np.linspace(0, 1, a)
    if r > 0: env[-r:] = np.linspace(1, 0, r)
    return env

# pad: detuned sine stack + one octave down, per chord with soft crossfade handled by attack/release
pos = 0.0
while pos < DUR:
    name = seq[int(pos // CHORD) % len(seq)]
    length = int(min(CHORD + 1.2, DUR - pos) * SR)   # overlap tail for smoothness
    if length <= 0: break
    seg = np.zeros(length)
    lt = np.arange(length) / SR
    for f in chords[name]:
        for det in (-0.6, 0.0, 0.7):   # slight detune for warmth
            seg += np.sin(2 * np.pi * (f + det) * lt)
        seg += 0.5 * np.sin(2 * np.pi * (f / 2) * lt)   # sub octave
    seg *= adsr(length, attack=1.5, release=2.2) / 7.0
    s0 = int(pos * SR)
    e0 = min(N, s0 + length)
    out[s0:e0] += seg[:e0 - s0]
    pos += CHORD

# gentle arpeggio pluck each second (decaying sine), following the current chord
for sec in range(int(DUR)):
    name = seq[int((sec) // CHORD) % len(seq)]
    f = chords[name][sec % 3] * 2   # an octave up, sparkly
    start = int(sec * SR)
    plen = int(0.9 * SR)
    lt = np.arange(plen) / SR
    pluck = np.sin(2 * np.pi * f * lt) * np.exp(-lt * 4.5) * 0.10
    e0 = min(N, start + plen)
    out[start:e0] += pluck[:e0 - start]

# global fade in / out
fi = int(1.5 * SR); fo = int(3.0 * SR)
out[:fi] *= np.linspace(0, 1, fi)
out[-fo:] *= np.linspace(1, 0, fo)

# soft limit + normalize to 0.5
out = np.tanh(out * 1.1)
out *= 0.5 / (np.max(np.abs(out)) + 1e-9)

# write 16-bit stereo wav
data = (out * 32767).astype(np.int16)
stereo = np.column_stack([data, data]).ravel()
with wave.open('/home/user/drayai1/video/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(stereo.tobytes())
print('music.wav written', len(data) / SR, 's')
