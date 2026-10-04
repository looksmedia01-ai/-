import {Easing, interpolate} from 'remotion';
import {poseAt} from './timeline';

// 모든 효과는 Math.random 없이 (프레임, 파티클 번호)만으로 계산한다.
// 같은 프레임은 언제 렌더해도 같은 그림이 나온다.

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// 0~1 사이 결정적 해시 (난수 아님: 같은 (i, salt)는 항상 같은 값).
// salt마다 값이 서로 얽히지 않아 각도·속도·크기가 한 줄로 정렬되지 않는다.
const spread = (i: number, salt = 0) => {
	const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
	return v - Math.floor(v);
};

// 구간 [from, to] 동안 fade 프레임에 걸쳐 0→1→0
const window01 = (f: number, from: number, to: number, fade = 6) =>
	interpolate(f, [from, from + fade, to - fade, to], [0, 1, 1, 0], clamp);

/* ───────────────────────── 화면 흔들림 ───────────────────────── */

// [시작 프레임, 세기(px)] — 착지·놀람 순간에 맞춤
const IMPACTS: [number, number][] = [
	[14, 22], // HELLO 첫 착지
	[37, 9], // HELLO 두 번째 착지
	[170, 14], // 화들짝
	[198, 10], // 놀람 점프 후 착지
	[273, 5], // 깡충 착지들
	[291, 5],
	[309, 5],
	[327, 7],
	[461, 30], // 피날레 쾅
];

export const shakeAt = (f: number) => {
	let x = 0;
	let y = 0;
	let rot = 0;
	for (const [f0, amp] of IMPACTS) {
		const a = f - f0;
		if (a < 0 || a > 24) continue;
		const decay = amp * Math.exp(-a / 5);
		x += decay * Math.sin(a * 2.3);
		y += decay * 0.7 * Math.sin(a * 3.1 + 1);
		rot += decay * 0.03 * Math.sin(a * 1.7 + 0.5);
	}
	return {x, y, rot};
};

/* ───────────────────────── 집중선 (SURPRISE) ───────────────────────── */

export const FocusLines: React.FC<{frame: number}> = ({frame}) => {
	const t = frame - 165;
	const env = window01(t, 2, 46, 5);
	if (env <= 0) return null;
	const N = 72;
	const cx = 960;
	const cy = 500;
	const R = 1400;
	const step = Math.floor(frame / 2); // 2프레임마다 선 배치가 바뀌며 지글거림
	const lines = Array.from({length: N}, (_, i) => {
		const ang = ((i + spread(i, step) * 0.6) / N) * Math.PI * 2;
		const inner = 470 + 170 * spread(i, step + 3) - 60 * env;
		const half = (0.004 + 0.009 * spread(i, step + 7)) * Math.PI;
		const p = (r: number, d: number) =>
			`${cx + Math.cos(ang + d) * r},${cy + Math.sin(ang + d) * r}`;
		return `M${p(inner, 0)} L${p(R, -half)} L${p(R, half)} Z`;
	});
	return (
		<svg
			width={1920}
			height={1080}
			style={{position: 'absolute', inset: 0, opacity: env * 0.6}}
		>
			<path d={lines.join(' ')} fill="#2B2340" />
		</svg>
	);
};

/* ───────────────────────── 비구름 (HMM?) ───────────────────────── */

const CLOUD_PUFFS: [number, number, number][] = [
	[-150, 20, 70],
	[-70, -30, 95],
	[40, -45, 105],
	[140, 0, 80],
	[0, 30, 90],
	[-90, 40, 70],
	[100, 40, 70],
];

export const RainCloud: React.FC<{frame: number}> = ({frame}) => {
	const t = frame - 345;
	if (t < 0 || t > 92) return null;
	const cx =
		interpolate(t, [0, 22], [2250, 1500], {...clamp, easing: Easing.out(Easing.cubic)}) +
		interpolate(t, [76, 92], [0, 800], {...clamp, easing: Easing.in(Easing.cubic)});
	const cy = 190 + 7 * Math.sin(t * 0.22);
	const rain = window01(t, 16, 84, 6);
	const bottom = cy + 80;
	const ground = 905;
	const fall = ground - bottom;

	const drops = Array.from({length: 22}, (_, i) => {
		const dx = -180 + (360 * (i + 0.5)) / 22 + 14 * (spread(i) - 0.5);
		const speed = 30 + 6 * spread(i, 2);
		const d = (t * speed + spread(i, 5) * fall) % fall; // 구름 아래에서 땅까지 반복
		return {x: cx + dx - d * 0.12, y: bottom + d, d, i};
	});

	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
			{rain > 0 &&
				drops.map(({x, y, d, i}) => {
					const nearGround = d > fall - 26;
					return nearGround ? (
						// 땅에 닿은 빗방울은 납작한 물튀김
						<ellipse
							key={i}
							cx={x}
							cy={ground}
							rx={10 + (d - (fall - 26))}
							ry={4}
							fill="none"
							stroke="#5B8FD9"
							strokeWidth={3}
							opacity={rain * (1 - (d - (fall - 26)) / 26)}
						/>
					) : (
						<line
							key={i}
							x1={x}
							y1={y}
							x2={x + 4}
							y2={y - 34}
							stroke="#5B8FD9"
							strokeWidth={6}
							strokeLinecap="round"
							opacity={rain * 0.85}
						/>
					);
				})}
			<g transform={`translate(${cx}, ${cy})`}>
				{CLOUD_PUFFS.map(([x, y, r], i) => (
					<circle key={`s${i}`} cx={x} cy={y + 14} r={r} fill="#6C7487" />
				))}
				{CLOUD_PUFFS.map(([x, y, r], i) => (
					<circle key={`c${i}`} cx={x} cy={y} r={r} fill="#8F98AB" />
				))}
				<ellipse cx={-30} cy={-60} rx={70} ry={30} fill="#A9B1C2" />
			</g>
		</svg>
	);
};

/* ───────────────────────── Zzz (HAPPY) ───────────────────────── */

export const Zzz: React.FC<{frame: number}> = ({frame}) => {
	const t = frame - 75;
	if (t < 14 || t > 92) return null;
	const pose = poseAt(frame);
	// 두 캐릭터 머리 사이 위쪽에서 피어오른다 (몸을 따라 움직임)
	const ax = 960 + pose.x + 170;
	const ay = 900 + pose.y - 540 * pose.stretch;
	const LIFE = 42;
	const items = [];
	for (let k = 0; k * 14 + 14 <= 80; k++) {
		const born = 14 + k * 14;
		const a = t - born;
		if (a < 0 || a > LIFE) continue;
		const p = a / LIFE;
		const opacity = interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 1, 0], clamp);
		items.push(
			<div
				key={k}
				style={{
					position: 'absolute',
					left: ax + 200 * p + 22 * Math.sin(a * 0.25 + k),
					top: ay - 240 * p,
					fontFamily: '"Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif',
					fontWeight: 900,
					fontSize: 70 + 80 * p,
					color: '#FFFFFF',
					WebkitTextStroke: '8px #7A5CC7',
					paintOrder: 'stroke fill',
					transform: `translate(-50%, -50%) rotate(${-12 + 10 * Math.sin(a * 0.2 + k)}deg)`,
					opacity,
				}}
			>
				Z
			</div>,
		);
	}
	return <>{items}</>;
};

/* ───────────────────────── 색종이 (TA-DA!) ───────────────────────── */

const CONFETTI_COLORS = ['#FF5D73', '#FFC93C', '#3CC8FF', '#6BE08A', '#B07CFF', '#FF8A3D'];

export const Confetti: React.FC<{frame: number}> = ({frame}) => {
	const a0 = frame - 461; // 피날레 착지 순간 발사
	if (a0 < 0) return null;
	const N = 150;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
			{Array.from({length: N}, (_, i) => {
				const left = i % 2 === 0;
				const delay = Math.floor(spread(i, 1) * 6);
				const a = a0 - delay;
				if (a < 0) return null;
				const x0 = left ? 60 : 1860;
				const deg = (left ? -62 : -118) + (spread(i, 2) - 0.5) * 50;
				const speed = 34 + 34 * spread(i, 3);
				const rad = (deg * Math.PI) / 180;
				const drag = (1 - Math.exp(-0.045 * a)) / 0.045;
				const x = x0 + Math.cos(rad) * speed * drag + 30 * Math.sin(a * 0.15 + i);
				const y = 1100 + Math.sin(rad) * speed * drag + 0.15 * a * a;
				const spin = i * 47 + a * (8 + 10 * spread(i, 4)) * (i % 3 === 0 ? -1 : 1);
				const flutter = Math.cos(a * (0.25 + 0.2 * spread(i, 5)) + i);
				const w = 24 + 16 * spread(i, 6);
				const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
				return (
					<g key={i} transform={`translate(${x}, ${y}) rotate(${spin}) scale(1, ${flutter})`}>
						{i % 4 === 0 ? (
							<circle r={w * 0.4} fill={color} />
						) : (
							<rect x={-w / 2} y={-w / 4} width={w} height={w / 2} rx={2} fill={color} />
						)}
					</g>
				);
			})}
		</svg>
	);
};

/* ───────────── 캐릭터에 붙는 효과: 눈물·땀방울 (원본 PNG 좌표계) ───────────── */

// 끝이 위로 뾰족한 물방울 (반지름 1 기준)
const DROP = 'M0,-1.6 C0.45,-0.8 1,-0.25 1,0.3 A1,1 0 1,1 -1,0.3 C-1,-0.25 -0.45,-0.8 0,-1.6 Z';

const Drop: React.FC<{
	x: number;
	y: number;
	r: number;
	rot?: number;
	opacity?: number;
	fill: string;
	stroke: string;
}> = ({x, y, r, rot = 0, opacity = 1, fill, stroke}) => (
	<g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${r})`} opacity={opacity}>
		<path d={DROP} fill={fill} stroke={stroke} strokeWidth={0.12} />
		<ellipse cx={-0.35} cy={0.1} rx={0.2} ry={0.35} fill="#FFFFFF" opacity={0.8} />
	</g>
);

// 웃음 눈물: 양쪽 눈꼬리에서 바깥으로 포물선을 그리며 뿜어져 나온다
const tears = (f: number) => {
	const t = f - 255;
	if (t < 2 || t > 92) return [];
	const EYES = [
		{x: 262, y: 585, dir: -1},
		{x: 1252, y: 590, dir: 1},
	];
	const LIFE = 16;
	const out = [];
	for (let k = 0; k * 3 + 2 <= 86; k++) {
		const born = 2 + k * 3;
		const a = t - born;
		if (a < 0 || a > LIFE) continue;
		for (const [e, eye] of EYES.entries()) {
			const vx = (7 + 5 * spread(k, e)) * eye.dir;
			const vy = -10 - 5 * spread(k, e + 2);
			const g = 1.1;
			const rot = (Math.atan2(vy + g * a, vx) * 180) / Math.PI - 90;
			out.push(
				<Drop
					key={`${k}-${e}`}
					x={eye.x + vx * a}
					y={eye.y + vy * a + 0.5 * g * a * a}
					r={22 * (1 - (a / LIFE) * 0.45)}
					rot={rot}
					opacity={interpolate(a, [0, 2, LIFE - 4, LIFE], [0, 1, 1, 0], clamp)}
					fill="#8FD8FF"
					stroke="#3D9BE0"
				/>,
			);
		}
	}
	return out;
};

// 땀방울: 톡 튀어나와 관자놀이를 타고 천천히 흘러내린다
const SWEAT: {from: number; to: number; x: number; y: number}[] = [
	{from: 201, to: 252, x: 210, y: 420}, // 놀람 착지 후 회색
	{from: 205, to: 252, x: 1330, y: 460}, // 놀람 착지 후 파랑
	{from: 389, to: 428, x: 1335, y: 440}, // HMM? 갸웃할 때 파랑
];

const sweat = (f: number) =>
	SWEAT.map((s, i) => {
		const a = f - s.from;
		if (a < 0 || f > s.to) return null;
		const pop = interpolate(a, [0, 5, 9], [0, 1.25, 1], clamp);
		const slide = interpolate(a, [6, s.to - s.from], [0, 55], {
			...clamp,
			easing: Easing.in(Easing.quad),
		});
		const fade = interpolate(f, [s.to - 6, s.to], [1, 0], clamp);
		return (
			<Drop
				key={`sweat${i}`}
				x={s.x}
				y={s.y + slide}
				r={34 * pop}
				opacity={fade}
				fill="#B8E6FF"
				stroke="#4AA8E0"
			/>
		);
	});

export const CharacterFx: React.FC<{frame: number; width: number; height: number}> = ({
	frame,
	width,
	height,
}) => (
	<svg
		viewBox="0 0 1448 1086"
		width={width}
		height={height}
		style={{position: 'absolute', inset: 0, overflow: 'visible'}}
	>
		{tears(frame)}
		{sweat(frame)}
	</svg>
);
