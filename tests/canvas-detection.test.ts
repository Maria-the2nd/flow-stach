/**
 * Test canvas/WebGL detection and validation
 */

import { detectCanvasWebGL, validateCanvasContainer } from '../lib/js-library-detector';
import { validateCanvasWebGLRequirements } from '../lib/preflight-validator';

describe('Canvas/WebGL Detection', () => {
  describe('detectCanvasWebGL', () => {
    test('should detect Three.js usage', () => {
      const jsCode = `
        const renderer = new THREE.WebGLRenderer();
        const scene = new THREE.Scene();
      `;
      const result = detectCanvasWebGL(jsCode);

      expect(result.detected).toBe(true);
      expect(result.libraries).toContain('threejs');
      expect(result.suggestedContainerId).toBe('three-container');
    });

    test('should detect Matter.js usage', () => {
      const jsCode = `
        const engine = Matter.Engine.create();
        const render = Matter.Render.create();
      `;
      const result = detectCanvasWebGL(jsCode);

      expect(result.detected).toBe(true);
      expect(result.libraries).toContain('matterjs');
      expect(result.suggestedContainerId).toBe('matter-container');
    });

    test('should detect Curtains.js usage', () => {
      const jsCode = `
        const curtains = new Curtains({
          container: "canvas"
        });
      `;
      const result = detectCanvasWebGL(jsCode);

      expect(result.detected).toBe(true);
      expect(result.libraries).toContain('curtains');
      expect(result.suggestedContainerId).toBe('curtains-container');
    });

    test('should detect generic canvas creation', () => {
      const jsCode = `
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
      `;
      const result = detectCanvasWebGL(jsCode);

      expect(result.detected).toBe(true);
      expect(result.libraries).toContain('generic-canvas');
    });

    test('should detect generic WebGL usage', () => {
      const jsCode = `
        const canvas = document.getElementById('myCanvas');
        const gl = canvas.getContext('webgl');
      `;
      const result = detectCanvasWebGL(jsCode);

      expect(result.detected).toBe(true);
      expect(result.libraries).toContain('generic-webgl');
      expect(result.suggestedContainerId).toBe('webgl-container');
    });

    test('should return no detection for code without canvas', () => {
      const jsCode = `
        console.log('Hello World');
        const data = { x: 1, y: 2 };
      `;
      const result = detectCanvasWebGL(jsCode);

      expect(result.detected).toBe(false);
      expect(result.libraries).toHaveLength(0);
    });
  });

  describe('validateCanvasContainer', () => {
    test('should pass validation when canvas tag exists', () => {
      const html = `<div><canvas id="myCanvas"></canvas></div>`;
      const detection = {
        detected: true,
        libraries: ['threejs' as const],
        suggestedContainerId: 'three-container'
      };

      const warnings = validateCanvasContainer(html, detection);
      expect(warnings).toHaveLength(0);
    });

    test('should pass validation when container ID exists', () => {
      const html = `<div id="three-container"></div>`;
      const detection = {
        detected: true,
        libraries: ['threejs' as const],
        suggestedContainerId: 'three-container'
      };

      const warnings = validateCanvasContainer(html, detection);
      expect(warnings).toHaveLength(0);
    });

    test('should warn when canvas code exists but no container', () => {
      const html = `<div class="wrapper"></div>`;
      const detection = {
        detected: true,
        libraries: ['threejs' as const],
        suggestedContainerId: 'three-container'
      };

      const warnings = validateCanvasContainer(html, detection);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('warning');
      expect(warnings[0].message).toContain('Three.js');
      expect(warnings[0].suggestion).toContain('three-container');
    });

    test('should not warn when no canvas code detected', () => {
      const html = `<div class="wrapper"></div>`;
      const detection = {
        detected: false,
        libraries: [],
        suggestedContainerId: 'canvas-container'
      };

      const warnings = validateCanvasContainer(html, detection);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('validateCanvasWebGLRequirements', () => {
    test('should validate complete flow - Three.js with container', () => {
      const html = `<div id="three-container"></div>`;
      const jsCode = `const renderer = new THREE.WebGLRenderer();`;

      const result = validateCanvasWebGLRequirements(html, jsCode);

      expect(result.hasIssues).toBe(false);
      expect(result.detection.detected).toBe(true);
      expect(result.detection.libraries).toContain('threejs');
      expect(result.warnings).toHaveLength(0);
    });

    test('should warn when Three.js detected without container', () => {
      const html = `<div class="hero"></div>`;
      const jsCode = `const renderer = new THREE.WebGLRenderer();`;

      const result = validateCanvasWebGLRequirements(html, jsCode);

      expect(result.hasIssues).toBe(true);
      expect(result.detection.detected).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Three.js');
    });

    test('should skip validation when no JS provided', () => {
      const html = `<div class="hero"></div>`;

      const result = validateCanvasWebGLRequirements(html);

      expect(result.hasIssues).toBe(false);
      expect(result.detection.detected).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
