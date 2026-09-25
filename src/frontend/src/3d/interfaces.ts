export interface BookProps {
  controlsRef: React.RefObject<any>;
  recipes: Recipe[];
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
  recipes: Recipe[];
}