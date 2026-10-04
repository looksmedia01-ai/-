# Mascot Showreel (Remotion, 17s)

표정 PNG 5장(`public/expressions/`)을 장면마다 갈아 끼우고, 몸 전체를 늘이기·누르기·튀기기·기울이기로 연기시키는 17초(510프레임 @30fps, 1920×1080) 쇼릴.

| # | 구간 | 표정 | 연기 |
|---|------|------|------|
| 1 | 0.0–2.5s | neutral (+눈웃음 깜빡) | 위에서 낙하 → 착지 스쿼시 → 작은 튕김 → 인사 기울이기 |
| 2 | 2.5–5.5s | happy | 팝 → 좌우 흔들며 깡충, 착지마다 눌림 |
| 3 | 5.5–8.5s | surprised | 화들짝 세로로 쭉 늘어나며 점프, 공중에서 덜덜 → 착지 후 뒤로 젖힘 |
| 4 | 8.5–11.5s | laugh | 깡충 4번 + 흔들 → 젖히고 킥킥 |
| 5 | 11.5–14.5s | curious | 오른쪽 위로 목을 쭉 빼고 기울임 → 갸웃 → 크게 웅크림(예비동작) |
| 6 | 14.5–17s | neutral → happy | 큰 점프 + 공중 한 바퀴 → 쾅 착지 → 출렁 → 마무리 |

```bash
npm install
npm run dev      # Remotion Studio 미리보기
npm run render   # out/showreel.mp4
```

- 연기 키프레임: `src/timeline.ts` (`acting()` — 장면별 x / y / stretch / rot / spin)
- 표정 교체 시점: `src/timeline.ts`의 `EXPRESSIONS`
- 가로 스케일은 부피 보존으로 자동 계산(`sx = 1 + (1 - stretch) * 0.8`), 기울기는 발밑 기준, 공중회전은 몸 중심 기준
- 표정마다 캐릭터 위치가 몇 px씩 달라서 `BOUNDS`로 정렬해 교체 시 튀지 않게 함
