"use client";

type DecorPiece = {
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const LEFT_PIECES: DecorPiece[] = [
  { file: "l-00.png", x: 0.5839, y: 0, w: 0.1277, h: 0.042 },
  { file: "l-01.png", x: 0.1022, y: 0.0771, w: 0.4234, h: 0.125 },
  { file: "l-02.png", x: 0.6825, y: 0.2227, w: 0.0803, h: 0.0459 },
  { file: "l-03.png", x: 0.0292, y: 0.2607, w: 0.1861, h: 0.0322 },
  { file: "l-04.png", x: 0.5949, y: 0.4482, w: 0.1533, h: 0.0381 },
  { file: "l-05.png", x: 0.7664, y: 0.459, w: 0.1569, h: 0.04 },
  { file: "l-06.png", x: 0.2664, y: 0.4902, w: 0.0839, h: 0.0205 },
  { file: "l-07.png", x: 0.5547, y: 0.502, w: 0.1825, h: 0.0781 },
  { file: "l-08.png", x: 0.4818, y: 0.6689, w: 0.0985, h: 0.0381 },
  { file: "l-09.png", x: 0, y: 0.749, w: 0.0766, h: 0.0205 },
  { file: "l-10.png", x: 0.1496, y: 0.7861, w: 0.5766, h: 0.127 },
  { file: "l-11.png", x: 0.5401, y: 0.9795, w: 0.1496, h: 0.0205 },
];

const RIGHT_PIECES: DecorPiece[] = [
  { file: "r-00.png", x: 0.4637, y: 0, w: 0.4718, h: 0.0967 },
  { file: "r-01.png", x: 0.375, y: 0.1309, w: 0.1573, h: 0.0215 },
  { file: "r-02.png", x: 0.0282, y: 0.2578, w: 0.2823, h: 0.0449 },
  { file: "r-03.png", x: 0.3468, y: 0.2617, w: 0.1573, h: 0.042 },
  { file: "r-04.png", x: 0.8992, y: 0.2764, w: 0.0887, h: 0.0195 },
  { file: "r-05.png", x: 0.4839, y: 0.2959, w: 0.1653, h: 0.042 },
  { file: "r-06.png", x: 0.2661, y: 0.3691, w: 0.0847, h: 0.0439 },
  { file: "r-07.png", x: 0.3589, y: 0.5273, w: 0.4879, h: 0.1172 },
  { file: "r-08.png", x: 0.9194, y: 0.5557, w: 0.0806, h: 0.0195 },
  { file: "r-09.png", x: 0.8024, y: 0.7354, w: 0.1935, h: 0.0313 },
  { file: "r-10.png", x: 0.3387, y: 0.8184, w: 0.1048, h: 0.0361 },
  { file: "r-11.png", x: 0.7379, y: 0.96, w: 0.1331, h: 0.04 },
];

const LEFT_VIEW = { w: 274, h: 1024 };
const RIGHT_VIEW = { w: 248, h: 1024 };
const BOTTOM_VIEW = { w: 1024, h: 496 };

const BOTTOM_PIECES: DecorPiece[] = [
  { file: "b-00.png", x: 0.1592, y: 0.0968, w: 0.0537, h: 0.0988 },
  { file: "b-01.png", x: 0.2207, y: 0.127, w: 0.0537, h: 0.1048 },
  { file: "b-02.png", x: 0.1455, y: 0.244, w: 0.0625, h: 0.2117 },
  { file: "b-03.png", x: 0, y: 0.3407, w: 0.0332, h: 0.0827 },
  { file: "b-04.png", x: 0.2197, y: 0.496, w: 0.0215, h: 0.1008 },
  { file: "b-05.png", x: 0.9658, y: 0.5282, w: 0.0342, h: 0.0827 },
  { file: "b-06.png", x: 0.8975, y: 0.625, w: 0.0225, h: 0.1008 },
  { file: "b-07.png", x: 0.6924, y: 0.744, w: 0.0244, h: 0.0565 },
  { file: "b-08.png", x: 0.3682, y: 0.748, w: 0.0244, h: 0.0565 },
  { file: "b-09.png", x: 0.8213, y: 0.8145, w: 0.0352, h: 0.0827 },
  { file: "b-10.png", x: 0.5742, y: 0.8226, w: 0.0459, h: 0.0645 },
  { file: "b-11.png", x: 0.4639, y: 0.8266, w: 0.0469, h: 0.0645 },
  { file: "b-12.png", x: 0.2959, y: 0.9194, w: 0.0361, h: 0.0806 },
];

function DecorSvg({
  className,
  view,
  pieces,
  folder,
  motion,
  preserveAspectRatio = "xMidYMid meet",
}: {
  className: string;
  view: { w: number; h: number };
  pieces: DecorPiece[];
  folder: string;
  motion: "a" | "b" | "c";
  preserveAspectRatio?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${view.w} ${view.h}`}
      preserveAspectRatio={preserveAspectRatio}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      {pieces.map((piece, index) => {
        const anim = `gift-decor-${motion}${(index % 4) + 1}`;
        return (
          <image
            key={piece.file}
            href={`/flow/${folder}/${piece.file}`}
            x={piece.x * view.w}
            y={piece.y * view.h}
            width={piece.w * view.w}
            height={piece.h * view.h}
            className={`gift-decor-piece ${anim}`}
            style={{ animationDelay: `${index * 0.12}s` }}
            preserveAspectRatio="xMidYMid meet"
          />
        );
      })}
    </svg>
  );
}

export function SideDecor({ side }: { side: "left" | "right" }) {
  return (
    <DecorSvg
      className={`gift-side-decor gift-side-decor-${side}`}
      view={side === "left" ? LEFT_VIEW : RIGHT_VIEW}
      pieces={side === "left" ? LEFT_PIECES : RIGHT_PIECES}
      folder={side === "left" ? "decor-left" : "decor-right"}
      motion={side === "left" ? "a" : "b"}
      preserveAspectRatio={side === "left" ? "xMinYMid meet" : "xMaxYMid meet"}
    />
  );
}

export function BottomDecor() {
  return (
    <DecorSvg
      className="gift-bottom-decor"
      view={BOTTOM_VIEW}
      pieces={BOTTOM_PIECES}
      folder="decor-bottom"
      motion="c"
    />
  );
}

export function TopDecor() {
  return (
    <DecorSvg
      className="gift-bottom-decor gift-top-decor"
      view={BOTTOM_VIEW}
      pieces={BOTTOM_PIECES}
      folder="decor-bottom"
      motion="c"
    />
  );
}
