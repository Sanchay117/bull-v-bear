import { Composition } from "remotion";
import { Film, type FilmProps } from "./Film.tsx";
import { FPS, makePlan } from "./plan.ts";

export function Root() {
  return (
    <Composition
      id="BullVBear"
      component={Film}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={FPS * 180}
      defaultProps={{ captions: true, music: true, repo: "" } satisfies FilmProps}
      calculateMetadata={async ({ props }) => {
        const plan = await makePlan();
        return { durationInFrames: plan.total, props: { ...props, plan } };
      }}
    />
  );
}
