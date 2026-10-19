export interface BookProps {
  controlsRef: React.RefObject<any>;
  registerCloseBook: (closeBook: () => void) => () => void;
  recipes: Recipe[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isChangingApiPage: boolean;
  onPreviousApiPage: () => void;
  onNextApiPage: () => void;
  onDefaultPage?: () => void;
  currentApiPage: number;
}

export interface fetchedValues {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  returnPage: Recipe[];
}

export interface Recipe {
  id: number;
  title: string;
  description: string;
  username: string;
}

export interface SceneContentProps {
  controlsRef: React.RefObject<any>;
  onOutsideClick: () => void;
  registerCloseBook: (closeBook: () => void) => () => void;
  recipes: Recipe[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isChangingApiPage: boolean;
  onPreviousApiPage: () => void;
  onNextApiPage: () => void;
  onDefaultPage?: () => void;
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