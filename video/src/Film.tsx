import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { OVERLAP, type Plan, type Shot } from "./plan.ts";
import { Argument } from "./scenes/Argument.tsx";
import { Close } from "./scenes/Close.tsx";
import { Cre } from "./scenes/Cre.tsx";
import { Discovery } from "./scenes/Discovery.tsx";
import { Filing } from "./scenes/Filing.tsx";
import { Live, Verify } from "./scenes/Footage.tsx";
import { Open } from "./scenes/Open.tsx";
import { Ruling } from "./scenes/Ruling.tsx";
import { Sentencing } from "./scenes/Sentencing.tsx";
import { Simulate } from "./scenes/Simulate.tsx";
import { Title } from "./scenes/Title.tsx";
import { Captions } from "./ui/Captions.tsx";

export interface SceneProps {
  shot: Shot;
  plan: Plan;
}

export interface FilmProps extends Record<string, unknown> {
  captions: boolean;
  music: boolean;
  /** Public repository URL for the closing card; hidden when empty. */
  repo: string;
  plan?: Plan;
}

const SCENES: Record<string, { component: ComponentType<SceneProps & { repo: string }>; night?: boolean }> = {
  open: { component: Open, night: true },
  title: { component: Title },
  discovery: { component: Discovery },
  argument: { component: Argument },
  ruling: { component: Ruling },
  sentencing: { component: Sentencing },
  filing: { component: Filing },
  cre: { component: Cre, night: true },
  simulate: { component: Simulate, night: true },
  live: { component: Live },
  verify: { component: Verify },
  close: { component: Close, night: true },
};

/** Fades a scene in over the overlap with the one before it. */
function CrossFade({ children, first }: { children: React.ReactNode; first: boolean }) {
  const frame = useCurrentFrame();
  const o = first ? 1 : interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

export function Film({ captions, music, repo, plan }: FilmProps) {
  if (!plan) return null;
  return (
    <AbsoluteFill style={{ background: "#0d0a07" }}>
      {plan.shots.map((shot, i) => {
        const scene = SCENES[shot.id];
        if (!scene) return null;
        const Scene = scene.component;
        return (
          <Sequence key={shot.id} from={shot.from} durationInFrames={shot.frames} name={shot.id}>
            <CrossFade first={i === 0}>
              <Scene shot={shot} plan={plan} repo={repo} />
              {captions && <Captions shot={shot} night={scene.night} />}
            </CrossFade>
          </Sequence>
        );
      })}
      {plan.shots.map(
        (shot) =>
          shot.take && (
            <Sequence key={`vo-${shot.id}`} from={shot.from + shot.voiceAt} durationInFrames={Math.ceil(shot.take.seconds * 30) + 2} name={`vo ${shot.id}`}>
              <Audio src={staticFile(shot.take.file)} />
            </Sequence>
          ),
      )}
      {music && <Bed total={plan.total} />}
    </AbsoluteFill>
  );
}

/** A quiet music bed under the narration, faded in and out. */
function Bed({ total }: { total: number }) {
  return (
    <Audio
      src={staticFile("sfx/bed.wav")}
      loop
      volume={(f) => interpolate(f, [0, 45, total - 120, total], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  );
}
