import type { ComponentRef, RefObject } from "react";

export type OrbitControlsRef = ComponentRef<
  typeof import("@react-three/drei").OrbitControls
>;

export interface BookProps {
  controlsRef: RefObject<OrbitControlsRef | null>;
  registerCloseBook: (closeBook: () => void) => () => void;
  recipes: Recipe[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isChangingApiPage: boolean;
  onPreviousApiPage: () => void;
  onNextApiPage: () => void;
  currentApiPage: number;
}

export interface RecipePageResponse {
  items: Array<{
    id: number;
    title: string;
    description: string;
    author: {
      username: string;
    } | null;
  }>;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface Recipe {
  id: number;
  title: string;
  description: string;
  username: string;
}

export interface SceneContentProps {
  controlsRef: RefObject<OrbitControlsRef | null>;
  onOutsideClick: () => void;
  registerCloseBook: (closeBook: () => void) => () => void;
  recipes: Recipe[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isChangingApiPage: boolean;
  onPreviousApiPage: () => void;
  onNextApiPage: () => void;
  currentApiPage: number;
}

export interface ApiPageButtonProps {
  direction: "previous" | "next";
  position: [number, number, number];
  faceAway?: boolean;
  visible: boolean;
  disabled: boolean;
  onClick: () => void;
}