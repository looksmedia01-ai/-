import {Composition} from 'remotion';
import {Showreel} from './Showreel';
import {DURATION, FPS} from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Showreel"
    component={Showreel}
    durationInFrames={DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
