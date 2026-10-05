// 9:16 세로 화면 레이아웃 (모든 컴포넌트·효과가 공유)
export const W = 1080;
export const H = 1920;

// 원본 표정 PNG 크기
export const SRC_W = 1448;
export const SRC_H = 1086;

// 캐릭터 표시 크기와 위치: 화면 가로를 거의 채우고, 화면 세로 가운데에 두고, 위는 효과·점프, 아래는 이름표 자리
export const CHAR_W = 900;
export const K = CHAR_W / SRC_W;
export const CHAR_H = SRC_H * K;
export const CENTER_X = W / 2;
export const GROUND_Y = 1180;
