import {
	AbsoluteFill,
	Audio,
	continueRender,
	delayRender,
	Img,
	interpolate,
	interpolateColors,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {
	DURATION,
	Expression,
	SCENES,
	expressionAt,
	poseAt,
	sceneIndexAt,
	FINALE_HIT,
} from './timeline';
import {CharacterFx, Confetti, FocusLines, RainCloud, Zzz, shakeAt} from './effects';
import {CENTER_X, CHAR_H, CHAR_W, GROUND_Y, K} from './layout';
import '@fontsource/jua/korean-400.css';
import '@fontsource/jua/latin-400.css';

// 한글 이름표 폰트(Jua)가 로드될 때까지 렌더를 기다린다
const fontHandle = delayRender('Jua 폰트 로딩');
document.fonts
	.load('400 80px Jua', '기본눈감음놀람웃음옆눈질울상땀0123456789')
	.then(() => continueRender(fontHandle))
	.catch(() => continueRender(fontHandle));

// 표정마다 살짝 다른 캐릭터 위치(원본 PNG에서 불투명 영역의 중앙·바닥)
const ANCHOR = {cx: 725, bottom: 946, middle: 576}; // middle = 불투명 영역의 세로 중심(공중회전 축)
const BOUNDS: Record<Expression, {cx: number; bottom: number}> = {
	neutral: {cx: 725, bottom: 946},
	happy: {cx: 722, bottom: 944},
	surprised: {cx: 725, bottom: 968},
	laugh: {cx: 733, bottom: 944},
	curious: {cx: 731, bottom: 968},
};
const ALL: Expression[] = ['neutral', 'happy', 'surprised', 'laugh', 'curious'];


const Background: React.FC<{frame: number}> = ({frame}) => {
	const idx = sceneIndexAt(frame);
	const prev = SCENES[Math.max(0, idx - 1)];
	const cur = SCENES[idx];
	const mix = idx === 0 ? 1 : interpolate(frame, [cur.from, cur.from + 8], [0, 1], {
		extrapolateRight: 'clamp',
	});
	const top = interpolateColors(mix, [0, 1], [prev.bg[0], cur.bg[0]]);
	const bottom = interpolateColors(mix, [0, 1], [prev.bg[1], cur.bg[1]]);
	return (
		<AbsoluteFill
			style={{background: `radial-gradient(ellipse at 50% 35%, ${top} 0%, ${bottom} 100%)`}}
		>
			{/* 바닥 */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: GROUND_Y,
					bottom: 0,
					background: 'linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0))',
				}}
			/>
		</AbsoluteFill>
	);
};

const Label: React.FC<{frame: number}> = ({frame}) => {
	const {fps} = useVideoConfig();
	const idx = sceneIndexAt(frame);
	const scene = SCENES[idx];
	const enter = spring({frame: frame - scene.from - 3, fps, config: {damping: 11, stiffness: 190}});
	// 피날레 착지 순간에는 이름표를 치워 화면을 비운다
	const leave = interpolate(frame, [FINALE_HIT - 4, FINALE_HIT + 4], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: GROUND_Y + 250, // 바닥 아래 빈 공간(세로 영상 자막 자리)
				display: 'flex',
				justifyContent: 'center',
				opacity: enter * leave,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 22,
					padding: '18px 54px 22px',
					borderRadius: 999,
					background: 'rgba(255,255,255,0.9)',
					color: '#2B2B3A',
					fontFamily: 'Jua, sans-serif',
					fontSize: 96,
					lineHeight: 1,
					boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
					transform: `translateY(${(1 - enter) * 50}px) scale(${0.6 + 0.4 * enter})`,
				}}
			>
				<span style={{fontSize: 52, opacity: 0.35}}>{idx + 1}</span>
				{scene.label}
			</div>
		</div>
	);
};

const Character: React.FC<{frame: number}> = ({frame}) => {
	const {x, y, stretch, rot, spin = 0} = poseAt(frame);
	// 부피 보존: 세로로 늘면 가로는 줄고, 눌리면 가로로 퍼진다
	const sx = 1 + (1 - stretch) * 0.8;
	const sy = stretch;
	const expr = expressionAt(frame);

	const lift = Math.max(0, -y);
	const shadowScale = (sx * CHAR_W) / 1080 / (1 + lift / 320);
	const shadowOpacity = 0.28 / (1 + lift / 200);

	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: CENTER_X + x - 460 * shadowScale,
					top: GROUND_Y - 34,
					width: 920 * shadowScale,
					height: 68,
					borderRadius: '50%',
					background: 'radial-gradient(closest-side, rgba(40,30,60,1), rgba(40,30,60,0))',
					opacity: shadowOpacity,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: CENTER_X - ANCHOR.cx * K,
					top: GROUND_Y - ANCHOR.bottom * K,
					width: CHAR_W,
					height: CHAR_H,
					transformOrigin: `${ANCHOR.cx * K}px ${ANCHOR.bottom * K}px`,
					transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${sx}, ${sy})`,
				}}
			>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						transformOrigin: `${ANCHOR.cx * K}px ${ANCHOR.middle * K}px`,
						transform: `rotate(${spin}deg)`,
					}}
				>
				{/* 모든 표정을 미리 올려두고 현재 표정만 보이게 해서 교체 시 깜빡임이 없다 */}
				{ALL.map((e) => {
					const b = BOUNDS[e];
					return (
						<Img
							key={e}
							src={staticFile(`expressions/${e}.png`)}
							style={{
								position: 'absolute',
								width: CHAR_W,
								height: CHAR_H,
								left: (ANCHOR.cx - b.cx) * K,
								top: (ANCHOR.bottom - b.bottom) * K,
								opacity: e === expr ? 1 : 0,
							}}
						/>
					);
				})}
				<CharacterFx frame={frame} width={CHAR_W} height={CHAR_H} />
				</div>
			</div>
		</>
	);
};

export const Showreel: React.FC = () => {
	const frame = useCurrentFrame();
	const shake = shakeAt(frame);
	const fadeIn = interpolate(frame, [0, 6], [1, 0], {extrapolateRight: 'clamp'});
	const fadeOut = interpolate(frame, [DURATION - 8, DURATION - 1], [0, 1], {
		extrapolateLeft: 'clamp',
	});
	return (
		<AbsoluteFill>
			{/* 120BPM 배경음악 (scripts/make-bgm.mjs로 생성). 박 = 15프레임 그리드와 0프레임에서 정렬 */}
			<Audio src={staticFile('bgm.wav')} />
			<Background frame={frame} />
			{/* 흔들릴 때 가장자리가 비지 않도록 배경을 한 번 더 깔고 그 위를 통째로 흔든다 */}
			<AbsoluteFill
				style={{
					transform: `translate(${shake.x}px, ${shake.y}px) rotate(${shake.rot}deg) scale(${
						1 + Math.min(0.04, Math.hypot(shake.x, shake.y) / 600)
					})`,
				}}
			>
				<Background frame={frame} />
				<FocusLines frame={frame} />
				<RainCloud frame={frame} />
				<Character frame={frame} />
				<Zzz frame={frame} />
				<Confetti frame={frame} />
			</AbsoluteFill>
			<Label frame={frame} />
			<AbsoluteFill style={{background: '#fff', opacity: Math.max(fadeIn, fadeOut)}} />
		</AbsoluteFill>
	);
};
