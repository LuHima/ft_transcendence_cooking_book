export interface BookProps {
  controlsRef: React.RefObject<any>;
  recipes: Recipe[];
}

export interface Recipe {
  id: number;
  title: string;
}

export interface SceneContentProps {
  controlsRef: React.RefObject<any>;
  recipes: Recipe[];
}