"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const sofaTransformationSources = {
  forward: {
    mp4: "/videos/home-sofa-transform-forward.mp4",
    poster: "/videos/home-sofa-transform-forward-poster.jpg",
    webm: "/videos/home-sofa-transform-forward.webm",
  },
  reverse: {
    mp4: "/videos/home-sofa-transform-reverse.mp4",
    poster: "/videos/home-sofa-transform-reverse-poster.jpg",
    webm: "/videos/home-sofa-transform-reverse.webm",
  },
} as const;

type SofaColor = "green" | "white";
type TransformationDirection = keyof typeof sofaTransformationSources;

export function HomeHeroVideo() {
  const forwardVideoRef = useRef<HTMLVideoElement>(null);
  const reverseVideoRef = useRef<HTMLVideoElement>(null);
  const [visibleDirection, setVisibleDirection] =
    useState<TransformationDirection>("forward");
  const [isPlaying, setIsPlaying] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<
    boolean | null
  >(null);
  const [sofaColor, setSofaColor] = useState<SofaColor>("green");

  const playDirection = useCallback((direction: TransformationDirection) => {
    const video =
      direction === "forward" ? forwardVideoRef.current : reverseVideoRef.current;

    if (!video) {
      return;
    }

    video.muted = true;
    video.setAttribute("muted", "");

    video.currentTime = 0;

    const playPromise = video.play();

    setIsPlaying(true);

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        setIsPlaying(false);
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setPrefersReducedMotion(false);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const applyMotionPreference = () => {
      setPrefersReducedMotion(reduceMotion.matches);
    };

    applyMotionPreference();
    reduceMotion.addEventListener("change", applyMotionPreference);

    return () => {
      reduceMotion.removeEventListener("change", applyMotionPreference);
    };
  }, []);

  useEffect(() => {
    const video = forwardVideoRef.current;

    if (!video || prefersReducedMotion === null) {
      return;
    }

    if (prefersReducedMotion) {
      [forwardVideoRef.current, reverseVideoRef.current].forEach(
        (transformationVideo) => {
          if (!transformationVideo) {
            return;
          }

          transformationVideo.pause();
          transformationVideo.currentTime = 0;
        },
      );
      setVisibleDirection("forward");
      setIsPlaying(false);
      setSofaColor("green");
      return;
    }

    setVisibleDirection("forward");
    playDirection("forward");
  }, [playDirection, prefersReducedMotion]);

  const handleToggleColor = () => {
    if (isPlaying) {
      return;
    }

    if (prefersReducedMotion) {
      const nextColor = sofaColor === "white" ? "green" : "white";

      [forwardVideoRef.current, reverseVideoRef.current].forEach((video) => {
        if (!video) {
          return;
        }

        video.pause();
        video.currentTime = 0;
      });

      setVisibleDirection(nextColor === "white" ? "reverse" : "forward");
      setSofaColor(nextColor);
      return;
    }

    const nextDirection = sofaColor === "white" ? "reverse" : "forward";

    playDirection(nextDirection);
  };

  const handlePlaying = (direction: TransformationDirection) => {
    setVisibleDirection(direction);
  };

  const handleEnded = (nextColor: SofaColor) => {
    setSofaColor(nextColor);
    setIsPlaying(false);
  };

  const forwardSources = sofaTransformationSources.forward;
  const reverseSources = sofaTransformationSources.reverse;

  return (
    <>
      <div className="home-sofa-stage">
        <button
          aria-label="Changer la couleur du canapé"
          className="home-preview-pill"
          disabled={isPlaying || prefersReducedMotion === null}
          onClick={handleToggleColor}
          type="button"
        >
          <span aria-hidden="true">✧</span>
          Changer la couleur
        </button>
        <video
          ref={forwardVideoRef}
          aria-hidden={visibleDirection !== "forward"}
          aria-label="Transformation du canapé entre le tissu vert et le tissu blanc"
          className={`home-sofa-transform-video${
            visibleDirection === "forward" ? "" : " home-sofa-transform-video-hidden"
          }`}
          data-active={visibleDirection === "forward" ? "true" : "false"}
          data-direction="forward"
          muted
          onEnded={() => handleEnded("white")}
          onPlaying={() => handlePlaying("forward")}
          playsInline
          poster={forwardSources.poster}
          preload="auto"
        >
          <source src={forwardSources.webm} type="video/webm" />
          <source src={forwardSources.mp4} type="video/mp4" />
        </video>
        <video
          ref={reverseVideoRef}
          aria-hidden={visibleDirection !== "reverse"}
          aria-label="Transformation du canapé entre le tissu blanc et le tissu vert"
          className={`home-sofa-transform-video${
            visibleDirection === "reverse" ? "" : " home-sofa-transform-video-hidden"
          }`}
          data-active={visibleDirection === "reverse" ? "true" : "false"}
          data-direction="reverse"
          muted
          onEnded={() => handleEnded("green")}
          onPlaying={() => handlePlaying("reverse")}
          playsInline
          poster={reverseSources.poster}
          preload="auto"
        >
          <source src={reverseSources.webm} type="video/webm" />
          <source src={reverseSources.mp4} type="video/mp4" />
        </video>
      </div>
    </>
  );
}
