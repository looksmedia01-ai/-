import {Composition} from 'remotion';
import {Showreel} from './Showreel';
import {DURATION, FPS} from './timeline';
import {H, W} from './layout';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Showreel"
    component={Showreel}
    durationInFrames={DURATION}
    fps={FPS}
    width={W}
    height={H}
  />
);
