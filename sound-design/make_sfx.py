import numpy as np, wave, sys
from scipy.signal import butter, sosfilt, lfilter

SR = 48000
DUR = 13.05
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def t_(d): return np.arange(int(d * SR)) / SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)

def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR); sig = sig[: max(0, N - i)]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.414
    R[i:i + len(sig)] += sig * gain * r * 1.414

def env(n, a, d):  # attack/decay seconds
    e = np.ones(n); na = max(1, int(a * SR)); nd = max(1, int(d * SR))
    e[:na] = np.linspace(0, 1, na); e[-nd:] *= np.linspace(1, 0, nd) ** 1.5
    return e

def resonator(x, f, bw):
    r = np.exp(-np.pi * bw / SR); th = 2 * np.pi * f / SR
    return lfilter([1 - r], [1, -2 * r * np.cos(th), r * r], x)

# ---------- bear voice: glottal pulses + vowel formants + growl ----------
VOW = {'u': [(320, 80), (800, 100), (2400, 150)],
       'o': [(450, 80), (850, 100), (2600, 150)],
       'a': [(750, 90), (1250, 110), (2600, 160)],
       'e': [(500, 80), (1800, 110), (2600, 160)],
       'i': [(300, 70), (2200, 120), (3000, 170)],
       'ng': [(260, 60), (1000, 250), (2300, 350)]}

def bear(segs, growl=0.0, breath=0.05, scale=1.0):
    """segs: list of (dur, f0_start, f0_end, vowel_start, vowel_end)"""
    out = []
    for d, f0a, f0b, va, vb in segs:
        n = int(d * SR); s = np.linspace(0, 1, n)
        f0 = f0a + (f0b - f0a) * (np.sin(s * np.pi / 2) ** 1.2)
        f0 *= 1 + 0.012 * np.sin(2 * np.pi * 5.5 * s * d)          # vibrato
        f0 *= 1 + 0.02 * lp(rng.standard_normal(n), 20) * 3       # jitter
        ph = np.cumsum(f0 / SR)
        src = 2 * (ph % 1) - 1                                     # saw source
        src = lp(src, 3500)
        if growl:
            am = 1 + growl * np.sign(np.sin(2 * np.pi * 34 * s * d + 3 * lp(rng.standard_normal(n), 60)))
            src *= am * 0.6 + 0.4
        src += breath * hp(rng.standard_normal(n), 1500)
        y = np.zeros(n)
        for k in range(3):
            fa, ba = VOW[va][k]; fb, bb = VOW[vb][k]
            # split into chunks to glide formants
            ch = 8; edges = np.linspace(0, n, ch + 1).astype(int)
            for c in range(ch):
                m = (c + .5) / ch; f = (fa + (fb - fa) * m) * scale
                seg = src[edges[c]:edges[c + 1]]
                y[edges[c]:edges[c + 1]] += resonator(seg, f, ba) * (1.0, 0.7, 0.25)[k]
        y *= env(n, 0.04, min(0.15, d * 0.4))
        out.append(y)
    y = np.concatenate(out)
    return y / (np.max(np.abs(y)) + 1e-9)

# ---------- instruments ----------
def bell(f, d=4.0, bright=1.0):          # temple bell / wind chime
    t = t_(d); y = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 1.0), (2.0, .5, 1.6), (2.76, .35, 2.4), (5.4, .2 * bright, 4), (8.93, .1 * bright, 6)]:
        y += amp * np.sin(2 * np.pi * f * ratio * t + rng.random() * 6) * np.exp(-t * dec * 1.2)
    y *= 1 + 0.15 * np.sin(2 * np.pi * 2.2 * t)            # beating
    return y * env(len(t), 0.002, 0.2)

def pluck(f, d=1.6):                      # gayageum-ish Karplus-Strong
    n = int(d * SR); p = int(SR / f)
    buf = rng.uniform(-1, 1, p); y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i % p]
        buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    y = lp(y, 4000)
    return y * env(n, 0.001, 0.3)

def whoosh(d, rise=True):
    n = int(d * SR); s = np.linspace(0, 1, n); x = rng.standard_normal(n)
    out = np.zeros(n); ch = 40; e = np.linspace(0, n, ch + 1).astype(int)
    for c in range(ch):
        m = c / ch; fc = 300 + (3500 if rise else 1500) * (m ** 2 if rise else 1 - m)
        out[e[c]:e[c + 1]] = bp(x[e[c]:e[c + 1]], fc * 0.6, fc * 1.4, 1)
    amp = (s ** 1.6) if rise else np.sin(np.pi * s)
    return out * amp * env(n, 0.01, 0.12)

def sparkle(start, count=10, base=1800, spread=0.6, gain=0.18):
    for k in range(count):
        f = base * 2 ** (rng.integers(0, 12) / 6)
        add(bell(f, 1.2, 0.3) * 0.5, start + k * spread / count + rng.random() * 0.03, gain, rng.uniform(-.8, .8))

def pop(f0=500, d=0.12):
    t = t_(d); f = f0 * (1 + 2.5 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30)

# ================= SCORE =================
# 1) festival crowd ambience (0 → fades under the bears)
n = N; crowd = bp(rng.standard_normal(n), 250, 2500, 2)
crowd *= 0.6 + 0.4 * lp(np.abs(rng.standard_normal(n)), 3) * 4
cenv = np.interp(np.arange(n) / SR, [0, 1.2, 6.5, 9.5, 13.05], [0, 1, 1, .45, .3])
add(crowd * cenv * 0.07, 0, 1, -0.3); add(bp(rng.standard_normal(n), 300, 2000) * cenv * 0.05, 0, 1, 0.3)

# 2) temple bells / wind chimes over the aerial shot
add(bell(110, 6, 0.4), 0.15, 0.35)            # big bell (범종 느낌)
add(bell(220, 4, 0.6), 3.1, 0.15, -0.2)
for k, tt in enumerate([1.6, 2.3, 4.4, 5.3]):
    add(bell(1320 * 2 ** (k / 5), 2.5, 0.3), tt, 0.06, [-0.6, 0.5, -0.3, 0.7][k])

# 3) soft pentatonic gayageum melody (D minor pentatonic)
pent = [146.8, 174.6, 196.0, 220.0, 261.6, 293.7, 349.2, 392.0, 440.0]
mel = [(0.9, 4), (1.7, 5), (2.5, 3), (3.3, 6), (4.1, 4), (4.9, 7), (5.6, 5), (6.3, 8)]
for tt, k in mel: add(pluck(pent[k]), tt, 0.14, -0.15)
for tt, k in [(0.9, 0), (2.5, 2), (4.1, 0), (5.6, 3)]: add(pluck(pent[k] / 2, 2.5), tt, 0.12, 0.2)

# 4) drone zoom: rising whoosh into the bears
add(whoosh(3.3, True), 6.15, 0.20)
add(whoosh(0.9, False), 9.25, 0.18, 0.3)
sparkle(9.35, 12, 1600, 0.7, 0.06)
add(bell(880, 2.5, 0.7), 9.45, 0.12)          # 포스터 등장 '띵~'
add(bell(1318.5, 2.5, 0.7), 9.62, 0.09)

# 5) bears! grey bear = 반이 (낮고 푸근한 목소리), blue bear = 달이 (높고 귀여운 목소리)
GREY_PAN, BLUE_PAN = -0.45, 0.45
# appear & notice the camera (7.8s~)
add(bear([(0.32, 125, 175, 'u', 'o'), (0.22, 175, 140, 'o', 'u')], growl=0.35), 7.75, 0.76, GREY_PAN)          # "우-웅?"
add(bear([(0.18, 330, 420, 'u', 'u'), (0.26, 430, 520, 'u', 'e')], growl=0.05, scale=1.15), 8.45, 0.65, BLUE_PAN)  # "꾸잉?"
# landing on close-up: happy greetings
def puff(d, lo, hi):                      # consonant noise: 'h' breath / 'kk' burst
    n = int(d * SR); return bp(rng.standard_normal(n), lo, hi) * env(n, 0.005, d * 0.7)

# 9.75s 반이 "우헝~!"  (우 → h 숨 → 헝, 끝은 ㅇ 받침으로 내려감)
add(bear([(0.16, 135, 170, 'u', 'u'), (0.10, 165, 185, 'u', 'o'), (0.30, 195, 160, 'o', 'o'), (0.22, 160, 115, 'o', 'ng')], growl=0.45), 9.75, 0.85, GREY_PAN)
add(puff(0.09, 500, 2500), 9.90, 0.10, GREY_PAN)
add(pop(520), 9.72, 0.10, GREY_PAN)
# 10.55s 달이 "꾸잉~!"  (ㄲ 터짐 → 짧은 우 → 이~ 올라갔다 내려감)
add(puff(0.025, 1500, 5000), 10.55, 0.35, BLUE_PAN)
add(bear([(0.10, 400, 470, 'u', 'u'), (0.14, 480, 640, 'u', 'i'), (0.26, 650, 600, 'i', 'i'), (0.18, 590, 450, 'i', 'ng')], growl=0.0, scale=1.1), 10.57, 0.70, BLUE_PAN)
add(pop(700), 10.52, 0.10, BLUE_PAN)
# 11.6s 같이 "우와~!"
add(bear([(0.20, 150, 190, 'u', 'u'), (0.12, 190, 215, 'u', 'a'), (0.55, 215, 160, 'a', 'a')], growl=0.35), 11.6, 0.75, GREY_PAN)
add(bear([(0.20, 380, 470, 'u', 'u'), (0.12, 470, 540, 'u', 'a'), (0.55, 540, 440, 'a', 'a')], growl=0.0, scale=1.2), 11.62, 0.64, BLUE_PAN)
# soft sniff/huff at end
add(hp(bp(rng.standard_normal(int(.25 * SR)), 600, 3000), 400) * env(int(.25 * SR), .05, .15), 12.55, 0.10, GREY_PAN)

# 6) closing chord
for f in [293.7, 440.0, 587.3]: add(bell(f, 3, 0.4), 12.45, 0.05)

# ---------- master ----------
mix = np.stack([L, R], 1)
mix *= np.interp(np.arange(N) / SR, [0, 0.05, 12.7, 13.05], [0, 1, 1, 0])[:, None]
peak = np.max(np.abs(mix)); mix = mix / peak * 0.85
w = wave.open(sys.argv[1], 'w'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
print('peak before norm', peak)
