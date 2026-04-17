"use client";

import {
  getVer,
  matchClass,
  type GuessCharacter,
} from "@/lib/guessUtils";

export function GuessTileRow(props: {
  guess: GuessCharacter;
  target: GuessCharacter;
}) {
  const { guess: g, target } = props;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
      <Tile
        label="キャラ名"
        value={g.name}
        ok={g.name === target.name}
        className={matchClass(g.name === target.name)}
      />
      <Tile
        label="元素"
        value={g.element}
        ok={g.element === target.element}
        className={matchClass(g.element === target.element)}
      />
      <Tile
        label="武器"
        value={g.weapon}
        ok={g.weapon === target.weapon}
        className={matchClass(g.weapon === target.weapon)}
      />
      <Tile
        label="地域"
        value={g.region}
        ok={g.region === target.region}
        className={matchClass(g.region === target.region)}
      />
      <Tile
        label="予想Ver"
        value={(() => {
          const gv = getVer(g);
          const tv = getVer(target);
          if (gv === null || tv === null) return "—";
          if (gv === tv) return String(gv);
          return `${gv} ${gv < tv ? "↑" : "↓"}`;
        })()}
        ok={(() => {
          const gv = getVer(g);
          const tv = getVer(target);
          return gv !== null && tv !== null && gv === tv;
        })()}
        className={matchClass(
          (() => {
            const gv = getVer(g);
            const tv = getVer(target);
            return gv !== null && tv !== null && gv === tv;
          })()
        )}
      />
    </div>
  );
}

function Tile(props: {
  label: string;
  value: string;
  ok: boolean;
  className: string;
}) {
  return (
    <div
      className={`flex min-h-[4.25rem] flex-col justify-center rounded-xl border px-2 py-2 text-center sm:min-h-[5rem] ${props.className}`}
    >
      <span className="text-[0.65rem] font-medium uppercase tracking-wider text-current/70">
        {props.label}
      </span>
      <span className="mt-1 text-sm font-semibold leading-tight sm:text-base">
        {props.value}
      </span>
    </div>
  );
}
