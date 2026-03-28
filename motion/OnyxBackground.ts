/**
 * OnyxBackground.ts
 *
 * Project Onyx - Fluid Background Dynamics & Interaction Physics
 *
 * This module implements a highly optimized WebGL/Canvas-based motion controller.
 * It generates the "Onyx ripples" effect, an interactive, low-GPU-usage background
 * that reacts to mouse coordinates and scroll velocity, simulating depth and
 * physical presence without relying on costly CSS filters.
 *
 * Performance Goal: Maintain 144Hz+ rendering cycle via requestAnimationFrame
 * tightly coupled to the hardware vsync signal.
 */

export class OnyxMotionController {
    private canvas: HTMLCanvasElement;
    private ctx: WebGLRenderingContext | null;

    // Shader Programs
    private program: WebGLProgram | null = null;

    // Interaction Physics State
    private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
    private scrollVelocity: number = 0;
    private targetScrollVelocity: number = 0;

    // Animation Loop Control
    private time: number = 0;
    private isRunning: boolean = false;
    private animationFrameId: number | null = null;

    /**
     * Initializes the WebGL context and shader pipeline.
     */
    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error(`[Onyx Motion] Canvas element '${canvasId}' not found.`);
        }

        this.ctx = this.canvas.getContext('webgl', {
            alpha: false, // Solid background for Deep Black
            antialias: false, // Performance optimization, rely on shader blur
            depth: false,
            powerPreference: 'high-performance'
        });

        if (!this.ctx) {
            throw new Error('[Onyx Motion] WebGL not supported. Falling back to static Deep Black.');
        }

        this.initShaders();
        this.initGeometry();
        this.bindEvents();
        this.resize();

        console.log('[Onyx Motion] WebGL pipeline initialized. Hardware acceleration active.');
    }

    /**
     * Compiles and links the vertex and fragment shaders.
     */
    private initShaders() {
        const gl = this.ctx;
        if (!gl) return;

        // --- Vertex Shader ---
        // A simple pass-through shader for a full-screen quad.
        const vsSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5; // Map [-1, 1] to [0, 1]
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        // --- Fragment Shader ---
        // Implements the generative "Onyx ripples" using noise algorithms
        // to simulate depth, reacting to uniform inputs (mouse, velocity).
        // Uses the Deep Black foundation and Silver Chrome highlights.
        const fsSource = `
            precision mediump float;
            varying vec2 v_uv;
            uniform float u_time;
            uniform vec2 u_mouse;
            uniform float u_velocity;
            uniform vec2 u_resolution;

            // Simple 2D pseudo-random noise function
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            // 2D Value Noise
            float noise(vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);

                // Four corners in 2D of a tile
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));

                // Smooth Interpolation
                vec2 u = f*f*(3.0-2.0*f);

                return mix(a, b, u.x) +
                        (c - a)* u.y * (1.0 - u.x) +
                        (d - b) * u.x * u.y;
            }

            void main() {
                // Base Color: Deep Black (#080808)
                vec3 baseColor = vec3(0.031, 0.031, 0.031);

                // Interaction Coordinates
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 mouseNorm = u_mouse / u_resolution;

                // Generative Ripple Algorithm (Simulating depth and fluid motion)
                // Scale UV by time and velocity for the fluid effect
                vec2 st = uv * 3.0;
                st.y += u_time * 0.1 + u_velocity * 0.05; // Scroll velocity impacts flow

                // Calculate distance to mouse cursor for the "Stitch-style" reactivity
                float distToMouse = distance(uv, vec2(mouseNorm.x, 1.0 - mouseNorm.y));

                // Add noise layers
                float n = noise(st + u_time * 0.2);
                n += 0.5 * noise(st * 2.0 - u_time * 0.1);

                // Subtle ripple intensity based on proximity to interaction point
                float rippleIntensity = smoothstep(0.4, 0.0, distToMouse);
                n += rippleIntensity * 0.3 * sin(distToMouse * 20.0 - u_time * 5.0);

                // Highlight Color: Silver Chrome (#C8C8C8) / Ghost White (#E8E8E8)
                vec3 highlightColor = vec3(0.78, 0.78, 0.78);

                // Blend noise into the base color, keeping it subtle (low GPU usage)
                // Only applying minimal highlights to maintain the "Black Glass" aesthetic
                vec3 finalColor = mix(baseColor, highlightColor, n * 0.08);

                // Output final fragment color
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

        if (!vertexShader || !fragmentShader) return;

        this.program = gl.createProgram();
        if (!this.program) return;

        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('[Onyx Motion] Shader linking failed:', gl.getProgramInfoLog(this.program));
            gl.deleteProgram(this.program);
            this.program = null;
        }
    }

    private compileShader(type: number, source: string): WebGLShader | null {
        const gl = this.ctx;
        if (!gl) return null;

        const shader = gl.createShader(type);
        if (!shader) return null;

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('[Onyx Motion] Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    /**
     * Sets up the full-screen quad geometry.
     */
    private initGeometry() {
        const gl = this.ctx;
        if (!gl || !this.program) return;

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Two triangles covering the entire screen [-1, 1]
        const positions = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0,
        ]);

        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const positionAttributeLocation = gl.getAttribLocation(this.program, "a_position");
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     * Binds mouse and scroll events to capture interaction physics parameters.
     */
    private bindEvents() {
        window.addEventListener('resize', () => this.resize());

        // Capture fluid interaction coordinates
        window.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });

        // Capture scroll velocity for weighted physics
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            const deltaY = window.scrollY - lastScrollY;
            this.targetScrollVelocity = deltaY; // Update target velocity
            lastScrollY = window.scrollY;
        }, { passive: true }); // Prevent jank
    }

    private resize() {
        if (!this.ctx) return;

        // Handle High-DPI displays while maintaining performance
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;

        this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * The main rendering loop synchronized with Chromium's vsync.
     */
    private render = (timestamp: number) => {
        if (!this.ctx || !this.program || !this.isRunning) return;
        const gl = this.ctx;

        // Calculate delta time
        this.time = timestamp * 0.001; // Convert to seconds

        // Interpolate scroll velocity (easing physics)
        // This provides the "weighted yet instantaneous" feel
        this.scrollVelocity += (this.targetScrollVelocity - this.scrollVelocity) * 0.1;

        // Decay target velocity if no scrolling is occurring
        this.targetScrollVelocity *= 0.95;

        // Use the shader program
        gl.useProgram(this.program);

        // Update Uniforms
        const timeLoc = gl.getUniformLocation(this.program, "u_time");
        gl.uniform1f(timeLoc, this.time);

        const mouseLoc = gl.getUniformLocation(this.program, "u_mouse");
        // Adjust mouse position for DPI scaling
        gl.uniform2f(mouseLoc, this.mousePosition.x * window.devicePixelRatio, this.mousePosition.y * window.devicePixelRatio);

        const velocityLoc = gl.getUniformLocation(this.program, "u_velocity");
        gl.uniform1f(velocityLoc, this.scrollVelocity);

        const resolutionLoc = gl.getUniformLocation(this.program, "u_resolution");
        gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);

        // Draw the quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Schedule next frame
        this.animationFrameId = requestAnimationFrame(this.render);
    };

    /**
     * Starts the interaction physics loop.
     */
    public start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animationFrameId = requestAnimationFrame(this.render);
            console.log('[Onyx Motion] Render loop started.');
        }
    }

    /**
     * Halts the render loop, e.g., when the browser is minimized to conserve resources.
     */
    public stop() {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }
        console.log('[Onyx Motion] Render loop paused.');
    }
}

// Example Initialization
// const backgroundController = new OnyxMotionController('onyx-bg-canvas');
// backgroundController.start();
