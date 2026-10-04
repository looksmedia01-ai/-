import {Easing, interpolate} from 'remotion';

export const FPS = 30;
export const DURATION = 17 * FPS; // 510 frames

export type Expression = 'neutral' | 'happy' | 'surprised' | 'laugh' | 'curious';

export type Scene = {
	from: number;
	label: string;
	bg: [string, string];
};

// 장면 구성 (프레임 기준, 30fps)
export const SCENES: Scene[] = [
	{from: 0, label: 'HELLO', bg: ['#FFF4E0', '#FFD9A8']},
	{from: 75, label: 'HAPPY', bg: ['#FFE6F0', '#FFB8D2']},
	{from: 165, label: 'SURPRISE!', bg: ['#FFF7C2', '#FFC94D']},
	{from: 255, label: 'HAHAHA', bg: ['#E3FFF3', '#8FE8C4']},
	{from: 345, label: 'HMM?', bg: ['#EEE8FF', '#BFAEFF']},
	{from: 435, label: 'TA-DA!', bg: ['#E3F2FF', '#8EC8FF']},
];

// 표정 교체 시점: 대부분 스쿼시(눌림) 순간이나 공중에서 갈아 끼워 컷이 튀지 않게 한다
const EXPRESSIONS: [number, Expression][] = [
	[0, 'neutral'],
	[61, 'happy'], // 인사하며 눈웃음 깜빡
	[65, 'neutral'],
	[75, 'happy'],
	[165, 'surprised'],
	[255, 'laugh'],
	[345, 'curious'],
	[435, 'neutral'],
	[461, 'happy'],
];

export const expressionAt = (f: number): Expression => {
	let current = EXPRESSIONS[0][1];
	for (const [at, e] of EXPRESSIONS) {
		if (f >= at) current = e;
	}
	return current;
};

export const sceneIndexAt = (f: number) => {
	let i = 0;
	SCENES.forEach((s, idx) => {
		if (f >= s.from) i = idx;
	});
	return i;
};

type Key = [frame: number, value: number, easing?: (t: number) => number];

const smooth = Easing.inOut(Easing.sin);
const fallIn = Easing.in(Easing.quad);
const riseOut = Easing.out(Easing.quad);
const snap = Easing.out(Easing.cubic);
const overshoot = Easing.out(Easing.back(2.2));

// 키프레임 트랙: 각 키의 easing은 "이전 키 → 이 키" 구간에 적용된다
const track = (f: number, keys: Key[]): number => {
	if (f <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		const [f1, v1, ease = smooth] = keys[i];
		const [f0, v0] = keys[i - 1];
		if (f <= f1) {
			return interpolate(f, [f0, f1], [v0, v1], {easing: ease});
		}
	}
	return keys[keys.length - 1][1];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type Pose = {
	x: number; // 좌우 이동(px)
	y: number; // 지면 기준 높이(px, 음수 = 위)
	stretch: number; // 세로 스케일. <1 누르기, >1 늘이기 (가로는 부피 보존으로 자동 계산)
	rot: number; // 기울기(deg), 발밑 중심 회전
	spin?: number; // 공중회전(deg), 몸 중심 회전
};

// 장면별 연기
const acting = (f: number): Pose => {
	// ── 1. HELLO: 위에서 떨어져 착지 → 작은 튕김 → 인사 기울이기
	if (f < 75) {
		return {
			x: 0,
			y: track(f, [
				[0, -1100],
				[14, 0, fallIn],
				[21, 0],
				[29, -95, riseOut],
				[37, 0, fallIn],
			]),
			stretch: track(f, [
				[0, 1.32],
				[13, 1.3],
				[16, 0.66, snap],
				[22, 1.14, snap],
				[29, 1.0],
				[36, 1.06],
				[39, 0.84, snap],
				[48, 1.0, overshoot],
				[56, 1.0],
				[60, 0.94],
				[66, 1.04],
				[72, 1.0],
			]),
			rot: track(f, [
				[0, 0],
				[48, 0],
				[58, -8],
				[66, 5],
				[75, 0],
			]),
		};
	}

	// ── 2. HAPPY: 눌렸다 튀어오르며 좌우로 흔들흔들 깡충
	if (f < 165) {
		const t = f - 75;
		const pop = track(t, [
			[0, 1],
			[4, 0.84, snap],
			[10, 1.1, snap],
			[16, 1.0],
		]);
		const env = clamp01((t - 14) / 8) * clamp01((80 - t) / 8);
		const phase = ((t - 14) / 32) * Math.PI * 2;
		const s = Math.sin(phase);
		const contact = Math.pow(1 - Math.abs(s), 6); // 바닥에 닿는 순간 1
		// 마지막에 놀라기 직전 살짝 웅크림(예비동작)
		const antic = track(t, [
			[0, 1],
			[82, 1],
			[90, 0.9, Easing.in(Easing.quad)],
		]);
		return {
			x: 6 * s * env,
			y: -38 * Math.abs(s) * env,
			stretch: pop * antic * (1 + env * (0.06 * Math.abs(s) - 0.12 * contact)),
			rot: 9 * s * env,
		};
	}

	// ── 3. SURPRISE: 화들짝 늘어나며 점프 → 공중에서 덜덜 → 착지 후 뒤로 젖힘
	if (f < 255) {
		const t = f - 165;
		const trembleAir = t > 5 && t < 24 ? 1 : 0;
		const shiver = clamp01((t - 42) / 4) * clamp01((86 - t) / 10);
		return {
			x: trembleAir * 6 * Math.sin(t * 2.9) + shiver * 2.5 * Math.sin(t * 3.7),
			y: track(t, [
				[0, 0],
				[6, -120, riseOut],
				[22, -132],
				[33, 0, fallIn],
			]),
			stretch: track(t, [
				[0, 0.9],
				[5, 1.4, snap],
				[22, 1.3],
				[32, 1.22],
				[35, 0.82, snap],
				[43, 1.06, snap],
				[50, 1.0],
				[80, 1.02],
				[90, 0.88, Easing.in(Easing.quad)],
			]),
			rot:
				track(t, [
					[0, 0],
					[6, 3],
					[22, -3],
					[33, 0],
					[44, -7, overshoot],
					[80, -6],
					[90, 0],
				]) + shiver * 1.2 * Math.sin(t * 4.3),
		};
	}

	// ── 4. HAHAHA: 깡충깡충 4번 + 좌우 흔들 → 뒤로 젖히고 킥킥
	if (f < 345) {
		const t = f - 255;
		if (t < 72) {
			const period = 18;
			const p = (t % period) / period;
			const air = 4 * p * (1 - p);
			const toContact = Math.min(p, 1 - p);
			const squash = Math.exp(-Math.pow(toContact / 0.07, 2));
			const height = [70, 90, 80, 110][Math.floor(t / period)];
			return {
				x: 0,
				y: -height * air,
				stretch: 1 + 0.14 * Math.abs(1 - 2 * p) * (1 - squash) - 0.24 * squash,
				rot: 8 * Math.sin((Math.PI * t) / period),
			};
		}
		const u = t - 72;
		const giggle = clamp01(u / 3);
		return {
			x: 0,
			y: -giggle * 7 * Math.abs(Math.sin(u * 1.6)),
			stretch:
				track(u, [
					[0, 0.78],
					[5, 1.08, snap],
					[18, 1.04],
				]) - giggle * 0.03 * Math.abs(Math.sin(u * 1.6)),
			rot: track(u, [
				[0, 0],
				[6, -9, overshoot],
				[18, -7],
			]),
		};
	}

	// ── 5. HMM?: 오른쪽 위를 보며 목을 쭉 빼고 기울임 → "음?" 갸웃 → 크게 웅크려 점프 준비
	if (f < 435) {
		const t = f - 345;
		const hold = clamp01((t - 22) / 6) * clamp01((70 - t) / 6);
		return {
			x: track(t, [
				[0, 0],
				[24, 55],
				[68, 55],
				[84, 0],
			]),
			y: track(t, [
				[0, 0],
				[24, -18],
				[68, -18],
				[78, 0],
			]) - hold * 5 * Math.sin(t * 0.35),
			stretch: track(t, [
				[0, 0.94],
				[24, 1.17],
				[44, 1.15],
				[50, 1.12],
				[56, 1.17],
				[70, 1.15],
				[78, 1.0],
				[88, 0.7, Easing.in(Easing.quad)],
				[90, 0.7],
			]),
			rot: track(t, [
				[0, -7],
				[24, 11, overshoot],
				[44, 11],
				[50, 4],
				[56, 13, overshoot],
				[70, 12],
				[82, 0],
			]),
		};
	}

	// ── 6. TA-DA!: 크게 점프하며 공중 한 바퀴 → 쾅 착지 → 출렁 → 마무리 포즈
	const t = f - 435;
	return {
		x: 0,
		y: track(t, [
			[0, 0],
			[13, -400, riseOut],
			[26, 0, fallIn],
		]),
		stretch: track(t, [
			[0, 0.7],
			[4, 1.45, snap],
			[12, 1.08],
			[18, 1.0],
			[24, 1.22],
			[27, 0.6, snap],
			[34, 1.14, snap],
			[41, 0.95],
			[48, 1.02],
			[54, 1.0],
		]),
		rot: 0,
		spin: track(t, [
			[0, 0],
			[3, 0],
			[23, -360, Easing.inOut(Easing.cubic)],
		]),
	};
};

export const poseAt = (f: number): Pose => {
	const pose = acting(f);
	// 땅에 붙어 있을 때만 숨쉬기
	const grounded = clamp01(1 - Math.abs(pose.y) / 10);
	return {
		...pose,
		stretch: pose.stretch * (1 + grounded * 0.012 * Math.sin(f / 9)),
	};
};
