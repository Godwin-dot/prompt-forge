"use client";

import { useEffect, useState } from "react";

type Props = {
  text: string;
  start?: boolean;
};

// Révèle le texte mot à mot (effet de streaming perçu). Respecte
// prefers-reduced-motion en affichant tout d'un coup.
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

export default function RevealText({ text, start = true }: Props) {
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    if (!start || reduced) {
      setCount(words.length);
      return;
    }
    setCount(0);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= words.length) clearInterval(timer);
    }, 12);
    return () => clearInterval(timer);
  }, [text, start, reduced, words.length]);

  return (
    <>
      {words.slice(0, count).join(" ")}
      {count < words.length ? " █" : ""}
    </>
  );
}