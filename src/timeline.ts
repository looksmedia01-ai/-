import {Easing, interpolate} from 'remotion';

export const FPS = 30;

// ── 박자 그리드: 120BPM → 1박 = 0.5초 = 15프레임, 1마디(4/4) = 60프레임
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15
export const BAR = BEAT * 4; // 60
export const beats = (n: number) => n * BEAT;

export type Expression = 'neutral' | 'happy' | 'surprised' | 'laugh' | 'curious';

export type Scene = {
	label: string;
	beats: number; // 장면 길이(박). 4의 배수면 다음 컷이 마디 첫 박에 떨어진다
	bg: [string, string];
	from: number; // 시작 프레임 (beats 누적으로 자동 계산)
};

// 장면 길이를 박 단위로 정의: 4+8+4+8+4+6 = 34박 = 17초
// 컷은 전부 마디 첫 박(60프레임 배수), 피날레 착지도 마디 첫 박(480)에 떨어진다
const SCENE_DEFS: Omit<Scene, 'from'>[] = [
	{label: 'HELLO', beats: 4, bg: ['#FFF4E0', '#FFD9A8']},
	{label: 'HAPPY', beats: 8, bg: ['#FFE6F0', '#FFB8D2']},
	{label: 'SURPRISE!', beats: 4, bg: ['#FFF7C2', '#FFC94D']},
	{label: 'HAHAHA', beats: 8, bg: ['#E3FFF3', '#8FE8C4']},
	{label: 'HMM?', beats: 4, bg: ['#EEE8FF', '#BFAEFF']},
	{label: 'TA-DA!', beats: 6, bg: ['#E3F2FF', '#8EC8FF']},
];

export const SCENES: Scene[] = SCENE_DEFS.reduce<Scene[]>((acc, s) => {
	const prev = acc[acc.length - 1];
	acc.push({...s, from: prev ? prev.from + beats(prev.beats) : 0});
	return acc;
}, []);

export const DURATION = SCENES.reduce((sum, s) => sum + beats(s.beats), 0); // 510

// 장면 시작 프레임 이름표 (효과·연기에서 공용)
export const S = {
	hello: SCENES[0].from, // 0
	happy: SCENES[1].from, // 60
	surprise: SCENES[2].from, // 180
	laugh: SCENES[3].from, // 240
	hmm: SCENES[4].from, // 360
	tada: SCENES[5].from, // 420
};
// 피날레 착지 = 마지막 마디 첫 박
export const FINALE_HIT = S.tada + beats(4); // 480

// 표정 교체 시점: 컷(마디 첫 박) 또는 착지 박에 맞춤
const EXPRESSIONS: [number, Expression][] = [
	[0, 'neutral'],
	[S.hello + 44, 'happy'], // 인사하며 눈웃음 깜빡
	[S.hello + 48, 'neutral'],
	[S.happy, 'happy'],
	[S.surprise, 'surprised'],
	[S.laugh, 'laugh'],
	[S.hmm, 'curious'],
	[S.tada, 'neutral'],
	[FINALE_HIT, 'happy'],
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

const B = BEAT;

// 장면별 연기 (t = 장면 내 프레임, 키프레임은 가능한 한 박(B의 배수)에 착지·컷을 둔다)
const acting = (f: number): Pose => {
	// ── 1. HELLO (4박): 떨어져 2박째에 착지 → 3박째에 한 번 더 튕겨 착지 → 4박째 인사 기울이기
	if (f < S.happy) {
		const t = f - S.hello;
		return {
			x: 0,
			y: track(t, [
				[0, -1100],
				[B, 0, fallIn], // 착지: 2박
				[B + 5, 0],
				[B + 10, -80, riseOut],
				[2 * B, 0, fallIn], // 착지: 3박
			]),
			stretch: track(t, [
				[0, 1.32],
				[B - 1, 1.3],
				[B + 2, 0.66, snap],
				[B + 6, 1.12, snap],
				[B + 10, 1.0],
				[2 * B - 1, 1.05],
				[2 * B + 2, 0.84, snap],
				[2 * B + 10, 1.0, overshoot],
				[3 * B + 6, 1.0],
				[3 * B + 10, 0.94],
				[4 * B, 1.0],
			]),
			rot: track(t, [
				[0, 0],
				[2 * B + 8, 0],
				[3 * B + 1, -8], // 4박째 인사
				[3 * B + 8, 5],
				[4 * B, 0],
			]),
		};
	}

	// ── 2. HAPPY (8박): 컷에 팝 → 매 박마다 좌우로 흔들며 깡충(착지가 박에 떨어짐)
	if (f < S.surprise) {
		const t = f - S.happy;
		const pop = track(t, [
			[0, 1],
			[4, 0.84, snap],
			[10, 1.1, snap],
			[B, 1.0],
		]);
		const env = clamp01((t - B) / 6) * clamp01((7 * B - t) / 6);
		// 주기 2박: |sin|=0(바닥 접촉)이 B, 2B, 3B …에 온다
		const phase = ((t - B) / (2 * B)) * Math.PI * 2;
		const s = Math.sin(phase);
		const contact = Math.pow(1 - Math.abs(s), 6);
		// 놀라기 직전 마지막 박에서 웅크림(예비동작)
		const antic = track(t, [
			[0, 1],
			[7 * B, 1],
			[8 * B, 0.9, Easing.in(Easing.quad)],
		]);
		return {
			x: 6 * s * env,
			y: -38 * Math.abs(s) * env,
			stretch: pop * antic * (1 + env * (0.06 * Math.abs(s) - 0.12 * contact)),
			rot: 9 * s * env,
		};
	}

	// ── 3. SURPRISE (4박): 컷(1박)에 화들짝 점프 → 2박째 착지 → 뒤로 젖히고 덜덜
	if (f < S.laugh) {
		const t = f - S.surprise;
		const trembleAir = t > 4 && t < B - 2 ? 1 : 0;
		const shiver = clamp01((t - 24) / 4) * clamp01((56 - t) / 8);
		return {
			x: trembleAir * 6 * Math.sin(t * 2.9) + shiver * 2.5 * Math.sin(t * 3.7),
			y: track(t, [
				[0, 0],
				[5, -120, riseOut],
				[11, -130],
				[B, 0, fallIn], // 착지: 2박
			]),
			stretch: track(t, [
				[0, 0.9],
				[4, 1.4, snap],
				[11, 1.3],
				[B - 1, 1.22],
				[B + 2, 0.82, snap],
				[B + 8, 1.06, snap],
				[2 * B - 2, 1.0],
				[3 * B + 7, 1.02],
				[4 * B, 0.88, Easing.in(Easing.quad)],
			]),
			rot:
				track(t, [
					[0, 0],
					[5, 3],
					[12, -3],
					[B, 0],
					[B + 9, -7, overshoot],
					[3 * B + 7, -6],
					[4 * B, 0],
				]) + shiver * 1.2 * Math.sin(t * 4.3),
		};
	}

	// ── 4. HAHAHA (8박): 박마다 깡충 6번 → 7~8박 뒤로 젖히고 킥킥
	if (f < S.hmm) {
		const t = f - S.laugh;
		if (t < 6 * B) {
			const p = (t % B) / B; // 매 박 시작 = 착지
			const air = 4 * p * (1 - p);
			const toContact = Math.min(p, 1 - p);
			const squash = Math.exp(-Math.pow(toContact / 0.08, 2));
			const height = [60, 75, 65, 85, 70, 105][Math.floor(t / B)];
			return {
				x: 0,
				y: -height * air,
				stretch: 1 + 0.14 * Math.abs(1 - 2 * p) * (1 - squash) - 0.24 * squash,
				rot: 8 * Math.sin((Math.PI * t) / B),
			};
		}
		const u = t - 6 * B;
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

	// ── 5. HMM? (4박): 1박에 오른쪽 위로 목을 쭉 → 2·3박 갸웃 → 4박 크게 웅크림
	if (f < S.tada) {
		const t = f - S.hmm;
		const hold = clamp01((t - 12) / 4) * clamp01((44 - t) / 4);
		return {
			x: track(t, [
				[0, 0],
				[B, 55],
				[3 * B, 55],
				[3 * B + 11, 0],
			]),
			y:
				track(t, [
					[0, 0],
					[B, -18],
					[3 * B, -18],
					[3 * B + 5, 0],
				]) - hold * 5 * Math.sin(t * 0.42),
			stretch: track(t, [
				[0, 0.94],
				[B, 1.17],
				[2 * B - 6, 1.15],
				[2 * B, 1.12],
				[2 * B + 5, 1.17],
				[3 * B, 1.15],
				[3 * B + 5, 1.0],
				[4 * B - 2, 0.7, Easing.in(Easing.quad)],
				[4 * B, 0.7],
			]),
			rot: track(t, [
				[0, -7],
				[B, 11, overshoot],
				[2 * B - 6, 11],
				[2 * B, 4], // 3박째 갸웃
				[2 * B + 6, 13, overshoot],
				[3 * B, 12],
				[3 * B + 10, 0],
			]),
		};
	}

	// ── 6. TA-DA! (6박): 1·2박 "준비, 준비" 움찔 → 3박 도약 → 5박(마디 첫 박) 쾅 착지 → 출렁
	const t = f - S.tada;
	const land = 4 * B; // = FINALE_HIT - S.tada
	return {
		x: 0,
		y: track(t, [
			[0, 0],
			[2 * B, 0],
			[3 * B, -400, riseOut],
			[land, 0, fallIn],
		]),
		stretch: track(t, [
			[0, 0.7],
			[7, 0.86],
			[B, 0.72, snap], // 2박 움찔
			[B + 7, 0.84],
			[2 * B, 0.66, snap], // 3박 도약 직전
			[2 * B + 4, 1.45, snap],
			[2 * B + 12, 1.08],
			[3 * B + 3, 1.0],
			[land - 2, 1.22],
			[land + 1, 0.6, snap],
			[land + 8, 1.14, snap],
			[land + 15, 0.95],
			[land + 22, 1.02],
			[land + 28, 1.0],
		]),
		rot: 0,
		spin: track(t, [
			[0, 0],
			[2 * B + 3, 0],
			[land - 3, -360, Easing.inOut(Easing.cubic)],
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
