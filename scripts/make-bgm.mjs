// 120BPM 통통 튀는 배경음악을 코드로 합성해 public/bgm.wav로 저장한다.
// 외부 샘플·의존성 없음. 노이즈도 시드 고정 생성기라 매번 같은 파일이 나온다.
//
//   node scripts/make-bgm.mjs
//
// 박자 그리드는 src/timeline.ts와 같다: 1박 = 0.5초(15프레임), 1마디 = 2초(60프레임).
// 장면 컷 = 마디 첫 박:
//   마디0 HELLO | 마디1-2 HAPPY | 마디3 SURPRISE | 마디4-5 HAHAHA | 마디6 HMM | 마디7 TA-DA 준비·도약 | 마디8 첫 박 = 착지 "쾅"

import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BAR = BEAT * 4; // 2s
const LENGTH = 17; // 초 (= 510프레임 @30fps)
const N = Math.ceil(SR * LENGTH);

const L = new Float32Array(N);
const R = new Float32Array(N);

// 시드 고정 노이즈 (LCG)
let seed = 20261004;
const noise = () => {
	seed = (seed * 1664525 + 1013904223) >>> 0;
	return seed / 2147483648 - 1;
};

const at = (bar, beat = 0) => bar * BAR + beat * BEAT;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// 샘플 하나씩 더하기. pan: -1(왼) ~ 1(오)
const render = (t0, dur, gain, pan, fn) => {
	const s0 = Math.round(t0 * SR);
	const len = Math.round(dur * SR);
	const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
	const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
	for (let i = 0; i < len && s0 + i < N; i++) {
		if (s0 + i < 0) continue;
		const v = fn(i / SR, i);
		L[s0 + i] += v * gl;
		R[s0 + i] += v * gr;
	}
};

/* ───────── 악기 ───────── */

const kick = (t0, g = 1) => {
	let ph = 0;
	render(t0, 0.4, 0.95 * g, 0, (t) => {
		const f = 48 + 120 * Math.exp(-t / 0.028);
		ph += (2 * Math.PI * f) / SR;
		return Math.sin(ph) * Math.exp(-t / 0.13);
	});
};

const snare = (t0, g = 1) => {
	let prev = 0;
	render(t0, 0.28, 0.5 * g, 0.05, (t) => {
		const n = noise();
		const bright = n - prev; // 1차 차분 = 고역 강조
		prev = n;
		return bright * 0.7 * Math.exp(-t / 0.07) + Math.sin(2 * Math.PI * 185 * t) * 0.6 * Math.exp(-t / 0.045);
	});
};

const hat = (t0, g = 1, open = false) => {
	let prev = 0;
	render(t0, open ? 0.3 : 0.06, 0.16 * g, 0.3, (t) => {
		const n = noise();
		const v = n - prev;
		prev = n;
		return v * Math.exp(-t / (open ? 0.09 : 0.018));
	});
};

const crash = (t0, g = 1) => {
	for (const pan of [-0.6, 0.6]) {
		let prev = 0;
		render(t0, 2.2, 0.22 * g, pan, (t) => {
			const n = noise();
			const v = n - prev;
			prev = n;
			return v * Math.exp(-t / 0.55);
		});
	}
};

// 고무공처럼 "통" 하고 튀는 베이스: 시작에 피치가 살짝 높았다가 떨어진다
const bass = (t0, midi, len = 0.2, g = 1) => {
	const f0 = hz(midi);
	let ph = 0;
	render(t0, len + 0.03, 0.34 * g, 0, (t) => {
		const f = f0 * (1 + 0.5 * Math.exp(-t / 0.012));
		ph += (2 * Math.PI * f) / SR;
		const env = Math.min(1, t / 0.003) * Math.exp(-t / (len * 0.7)) * Math.min(1, (len + 0.03 - t) / 0.02);
		return (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) * env;
	});
};

// 마림바: 기음 + 4배음(짧게 사라지는 "똑" 소리)
const marimba = (t0, midi, g = 1, pan = 0.15, decay = 0.32) => {
	const f = hz(midi);
	render(t0, decay * 4, 0.3 * g, pan, (t) => {
		const a = Math.min(1, t / 0.002);
		return a * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / decay) + 0.3 * Math.sin(2 * Math.PI * 4 * f * t) * Math.exp(-t / 0.05));
	});
};

// 뒷박 코드 스탭 (짧게 끊는 플럭)
const stab = (t0, notes, g = 1, decay = 0.09) => {
	notes.forEach((m, i) => {
		const f = hz(m);
		render(t0, decay * 5, 0.11 * g, -0.35 + i * 0.12, (t) => {
			const ph = 2 * Math.PI * f * t;
			const tri = Math.sin(ph) - Math.sin(3 * ph) / 9 + Math.sin(5 * ph) / 25;
			return tri * Math.min(1, t / 0.003) * Math.exp(-t / decay);
		});
	});
};

/* ───────── 화성·패턴 ───────── */

const CHORDS = {
	C: {root: 36, stab: [64, 67, 72]},
	Am: {root: 45, stab: [64, 69, 72]},
	F: {root: 41, stab: [65, 69, 72]},
	G: {root: 43, stab: [62, 67, 71]},
};

// 기본 그루브: 박마다 킥(캐릭터가 박마다 착지), 2·4박 스네어, 뒷박 하이햇·코드 스탭, 8분 옥타브 베이스
const groove = (bar, chord, {busyHats = false} = {}) => {
	const c = CHORDS[chord];
	for (let b = 0; b < 4; b++) {
		kick(at(bar, b), b % 2 === 0 ? 1 : 0.8);
		if (b % 2 === 1) snare(at(bar, b));
		hat(at(bar, b + 0.5), 1, b === 3);
		if (busyHats) {
			hat(at(bar, b + 0.25), 0.5);
			hat(at(bar, b + 0.75), 0.5);
		}
		stab(at(bar, b + 0.5), c.stab);
		bass(at(bar, b), c.root);
		bass(at(bar, b + 0.5), c.root + 12, 0.16, 0.8);
	}
};

const melody = (bar, notes, g = 1) => notes.forEach(([beat, m]) => marimba(at(bar, beat), m, g));

/* ───────── 편곡 (마디 = 장면) ───────── */

// 마디0 HELLO (C): 착지(2박)·튕김(3박)이 킥에 맞는다
groove(0, 'C');
melody(0, [[0, 72], [0.5, 76], [1, 79], [1.5, 76], [2, 84], [3, 79], [3.5, 76]]);

// 마디1-2 HAPPY (Am → F): 박마다 흔들며 깡충
crash(at(1), 0.7);
groove(1, 'Am');
melody(1, [[0, 81], [0.5, 79], [1, 76], [2, 72], [2.5, 76], [3, 79]]);
groove(2, 'F');
melody(2, [[0, 77], [0.5, 81], [1, 84], [2, 81], [2.5, 77], [3, 74], [3.5, 77]]);

// 마디3 SURPRISE (G): 스톱 타임. 1박 "빵!"(컷) → 2박 착지 "쿵" → 정적 속 떨리는 트릴 → 3.5박 픽업
crash(at(3), 1);
kick(at(3, 0), 1.1);
stab(at(3, 0), [62, 65, 67, 71], 1.6, 0.25);
bass(at(3, 0), 43, 0.4);
kick(at(3, 1));
snare(at(3, 1), 0.8);
bass(at(3, 1), 43, 0.25);
for (let i = 0; i < 8; i++) {
	marimba(at(3, 2 + i * 0.25), i % 2 === 0 ? 83 : 84, 0.55, 0.3, 0.12);
}
hat(at(3, 2.5));
snare(at(3, 3.5), 0.6);
snare(at(3, 3.75), 0.8);

// 마디4-5 HAHAHA (C → Am): 박마다 깡충 = 박마다 킥, 16분 하이햇으로 들뜬 느낌
crash(at(4), 0.9);
groove(4, 'C', {busyHats: true});
melody(4, [[0, 84], [0.5, 79], [0.75, 81], [1, 84], [1.5, 88], [2, 86], [2.5, 84], [3, 79], [3.5, 81]]);
groove(5, 'Am', {busyHats: true});
melody(5, [[0, 81], [0.5, 84], [1, 88], [1.5, 84], [2, 81], [2.5, 79], [3, 76], [3.5, 79]]);

// 마디6 HMM? (F → Fm): 드럼을 빼고 조용히. 3박째 갸웃에 맞춰 단조로 기울며 "음?" 하고 올라간다
crash(at(6), 0.4);
kick(at(6, 0), 0.7);
bass(at(6, 0), 41, 1.0, 0.8);
bass(at(6, 2), 41, 0.9, 0.8);
stab(at(6, 0), [65, 69, 72], 0.9, 0.3);
stab(at(6, 2), [65, 68, 72], 0.9, 0.3); // F → Fm
for (let b = 0; b < 4; b++) hat(at(6, b + 0.5), 0.6);
melody(6, [[1, 72], [1.5, 74], [2, 77], [3, 80]], 0.9);

// 마디7 TA-DA 준비 (G): 1·2박 "준비, 준비" 움찔 → 3박 도약부터 상승 아르페지오 + 스네어 롤
kick(at(7, 0));
kick(at(7, 1));
bass(at(7, 0), 43, 0.2);
bass(at(7, 1), 43, 0.2);
stab(at(7, 0), CHORDS.G.stab, 1);
stab(at(7, 1), CHORDS.G.stab, 1);
kick(at(7, 2), 1.1);
[67, 71, 74, 77, 79, 83, 86, 89].forEach((m, i) => marimba(at(7, 2 + i * 0.25), m, 0.9, 0.2, 0.15));
for (let i = 0; i < 8; i++) snare(at(7, 2 + i * 0.25), 0.3 + i * 0.08);
stab(at(7, 3.5), [67, 71, 74, 79], 1.5, 0.12); // "따—"

// 마디8 첫 박 = 피날레 착지 "쾅!": 크래시 + 킥 + 큰 C 코드가 울리며 끝
crash(at(8), 1.3);
kick(at(8), 1.3);
bass(at(8), 36, 0.9, 1.2);
bass(at(8), 24, 0.9, 0.8);
stab(at(8), [60, 64, 67, 72, 76], 2, 0.5);
[72, 76, 79, 84, 88].forEach((m, i) => marimba(at(8) + i * 0.012, m, 0.8, -0.3 + i * 0.15, 0.6));

/* ───────── 마스터: 소프트 클립 → 정규화 → 끝 페이드 → 16bit WAV ───────── */

let peak = 0;
for (let i = 0; i < N; i++) {
	L[i] = Math.tanh(L[i] * 1.1);
	R[i] = Math.tanh(R[i] * 1.1);
	peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
const fadeFrom = N - Math.round(0.25 * SR);

const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(2, 22); // stereo
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
	const fade = i > fadeFrom ? (N - i) / (N - fadeFrom) : 1;
	buf.writeInt16LE(Math.round(L[i] * norm * fade * 32767), 44 + i * 4);
	buf.writeInt16LE(Math.round(R[i] * norm * fade * 32767), 46 + i * 4);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'bgm.wav');
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, buf);
console.log(`wrote ${out} (${LENGTH}s, ${BPM}BPM)`);
