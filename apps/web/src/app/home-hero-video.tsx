"use client";

import { useEffect, useRef } from "react";

export function HomeHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = true;
    video.setAttribute("muted", "");

    if (typeof window.matchMedia !== "function") {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const applyMotionPreference = () => {
      if (reduceMotion.matches) {
        video.pause();
        video.currentTime = 0;
      } else {
        void video.play();
      }
    };

    applyMotionPreference();
    reduceMotion.addEventListener("change", applyMotionPreference);

    return () => {
      reduceMotion.removeEventListener("change", applyMotionPreference);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      aria-label="Démonstration vidéo de simulation de canapé à domicile"
      autoPlay
      loop
      muted
      playsInline
      poster="/videos/home-hero-poster.jpg"
    >
      <source src="/videos/home-hero-pingpong.webm" type="video/webm" />
      <source src="/videos/home-hero-pingpong.mp4" type="video/mp4" />
    </video>
  );
}
