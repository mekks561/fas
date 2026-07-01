declare module 'react-babylonjs' {
  import * as React from 'react';
  
  export interface EngineProps {
    antialias?: boolean;
    adaptToDeviceRatio?: boolean;
    onSceneReady?: (engine: unknown) => void;
    children?: React.ReactNode;
  }
  
  export interface SceneMountProps {
    onSceneMount?: (params: { scene: unknown; engine: unknown }) => void;
    children?: React.ReactNode;
  }
  
  export const Engine: React.FC<EngineProps>;
  export const Scene: React.FC<SceneMountProps>;
  
  export default function useScene(): unknown;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: unknown;
      arcRotateCamera: unknown;
      hemisphericLight: unknown;
      directionalLight: unknown;
      transformNode: unknown;
    }
  }
}
