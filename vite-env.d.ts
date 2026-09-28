/// <reference types="vite/client" />

// n8ao ships no type declarations; only N8AOPostPass is used (js/core/engine.ts).
declare module 'n8ao' {
  import type { Pass } from 'postprocessing';
  import type { Camera, Color, Scene } from 'three';
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: {
      aoRadius: number; distanceFalloff: number; intensity: number; aoSamples: number;
      denoiseSamples: number; denoiseRadius: number; halfRes: boolean; color: Color;
      gammaCorrection: boolean; screenSpaceRadius: boolean; depthAwareUpsampling: boolean;
      [k: string]: unknown;
    };
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
  }
}
