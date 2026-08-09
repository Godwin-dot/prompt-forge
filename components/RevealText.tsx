"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  text: string;
  start?: boolean;
};

// Révèle le texte mot à mot par paquets (effet de streaming perçu) sans
// casser le CPU : un paquet de mots à chaque tick au lieu d'un seul mot.
// Respecte prefers-reduced-motion en affichant tout d'un coup.
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const TICK_MS = 50;
const WORDS_PER_TICK = 8;

export default function RevealText({ text, start = true }: Props) {
  const reduced = usePrefersReducedMotion();
  const [visibleCount, setVisibleCount] = useState(0);
  const words = useMemo(() => text.split(" "), [text]);
  const countRef = useRef(0);

  useEffect(() => {
    if (!start || reduced) {
      setVisibleCount(words.length);
      return;
    }
    countRef.current = 0;
    setVisibleCount(0);
    const timer = setInterval(() => {
      countRef.current = Math.min(
        countRef.current + WORDS_PER_TICK,
        words.length
      );
      setVisibleCount(countRef.current);
      if (countRef.current >= words.length) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [text, start, reduced, words.length]);

  return (
    <>
      {words.slice(0, visibleCount).join(" ")}
      {visibleCount < words.length ? " █" : ""}
    </>
  );
}