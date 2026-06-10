declare module 'react-babylonjs' {
  import * as React from 'react';
  
  export interface EngineProps {
    antialias?: boolean;
    adaptToDeviceRatio?: boolean;
    onSceneReady?: (engine: any) => void;
    children?: React.ReactNode;
  }
  
  export interface SceneMountProps {
    onSceneMount?: (params: { scene: any; engine: any }) => void;
    children?: React.ReactNode;
  }
  
  export const Engine: React.FC<EngineProps>;
  export const Scene: React.FC<SceneMountProps>;
  
  export default function useScene(): any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      arcRotateCamera: any;
      hemisphericLight: any;
      directionalLight: any;
      transformNode: any;
    }
  }
}
