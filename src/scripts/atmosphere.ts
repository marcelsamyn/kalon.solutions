// Late-afternoon sun through a window: drifting light shafts, haze, and dust
// motes, drawn on one WebGL canvas that sits over the page with
// `mix-blend-mode: hard-light`. Under hard-light, 50% gray changes nothing,
// darker values shade the page and lighter values light it, so one layer can
// both dim the room and make the text inside a shaft glow.

// The light drifts slowly, so 30fps looks smooth and halves the GPU work.
const FRAME_INTERVAL_MS = 1000 / 30;
// rAF timestamps jitter; without slack a 60Hz display would sometimes skip to 20fps.
const FRAME_SLACK_MS = 2;
const MAX_STEP_S = 0.05;
const STIR_RADIUS_PX = 160;

// Shared by the light pass and the dust pass so motes glow only where a shaft
// actually falls. Coordinates are CSS pixels, y pointing down.
const SUNLIGHT_GLSL = /* glsl */ `
	uniform vec2 u_viewport;
	uniform float u_time;

	float hash11(float n) { return fract(sin(n) * 43758.5453); }
	float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

	float noise1(float x) {
		float i = floor(x);
		float f = fract(x);
		return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f));
	}

	float noise2(vec2 p) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		vec2 u = f * f * (3.0 - 2.0 * f);
		return mix(
			mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
			mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
			u.y
		);
	}

	float fbm(vec2 p) {
		float sum = 0.0;
		float amp = 0.5;
		for (int i = 0; i < 4; i++) {
			sum += amp * noise2(p);
			p = p * 2.03 + 17.0;
			amp *= 0.5;
		}
		return sum;
	}

	// Position measured from the window, in viewport diagonals:
	// x runs across the shafts, y along them.
	vec2 windowSpace(vec2 p) {
		vec2 dir = normalize(vec2(1.0, 0.82));
		vec2 q = (p - vec2(-0.12, -0.2) * u_viewport) / length(u_viewport);
		return vec2(dot(q, vec2(-dir.y, dir.x)), dot(q, dir));
	}

	// Sunlight reaching p, roughly 0..1.
	float sunlight(vec2 p) {
		float t = u_time;
		vec2 w = windowSpace(p);
		float along = w.y;
		// Shafts spread a little as they travel away from the window.
		float across = w.x / (1.0 + along * 0.5);
		// Keep the bundle of light centred on the screen whatever its shape.
		vec2 middle = windowSpace(u_viewport * 0.5);
		float offCentre = across - middle.x / (1.0 + middle.y * 0.5);

		// Branches outside sway the whole bundle; leaves make shafts shimmer.
		float sway = sin(t * 0.11) * 0.012 + sin(t * 0.047 + 1.3) * 0.018;
		float x = (across + sway) * 13.0;
		float pattern = noise1(x + t * 0.02) * 0.65 + noise1(x * 2.3 - t * 0.03 + 9.0) * 0.35;
		// Edges are crisp near the window and blur with distance, like real shadows.
		float penumbra = mix(0.07, 0.2, smoothstep(0.0, 1.2, along));
		float shafts = smoothstep(0.58 - penumbra, 0.58 + penumbra, pattern);
		// Fine streaks inside each shaft, like light through old glass.
		shafts *= 0.72 + 0.28 * noise1(x * 7.0 + t * 0.05);
		float shimmer = 0.85 + 0.15 * noise1(x * 1.9 + t * 0.8);
		// Some panes let more light through than others.
		float strength = 0.4 + 0.6 * noise1(x * 0.3 + 3.0 + t * 0.008);

		// The window only lets a band of light through.
		float spread = offCentre / 0.42;
		float aperture = exp(-spread * spread);

		// Light thins out away from the window.
		float reach = mix(1.0, 0.45, smoothstep(0.0, 1.3, along));

		// Haze drifting through the beams makes them uneven, like air with dust in it.
		vec2 drift = vec2(t * 0.011, -t * 0.007);
		float haze = 0.35 + 0.95 * fbm(vec2(across * 5.0, along * 2.2) + drift);

		// Now and then a thin cloud dims the sun for a while.
		float cloud = 0.75 + 0.25 * smoothstep(0.25, 0.75, noise1(t * 0.035 + 4.0));

		return shafts * shimmer * strength * aperture * reach * haze * cloud;
	}
`;

const LIGHT_VERTEX = /* glsl */ `
	attribute vec2 a_corner;
	void main() {
		gl_Position = vec4(a_corner, 0.0, 1.0);
	}
`;

const LIGHT_FRAGMENT = /* glsl */ `
	#ifdef GL_FRAGMENT_PRECISION_HIGH
	precision highp float;
	#else
	precision mediump float;
	#endif
	${SUNLIGHT_GLSL}

	void main() {
		// One canvas pixel per CSS pixel: the light is soft, so retina adds only cost.
		vec2 p = vec2(gl_FragCoord.x, u_viewport.y - gl_FragCoord.y);
		vec2 w = windowSpace(p);
		float light = sunlight(p);

		// Soft glow where the window spills in, top left.
		float spill = exp(-length(w) * 3.5);

		// The room sits in warm shade, deepest in the corner farthest from the
		// window. Sunlight lifts that shade wherever it falls.
		float corner = smoothstep(0.2, 1.3, w.y);
		float lit = clamp(light * 2.0 + spill * 0.8, 0.0, 1.0);
		float shade = (0.08 + 0.07 * corner) * (1.0 - lit * 0.95);

		// Gold lives in the light (red pushed up, blue pulled down), paler in the
		// dense core of a shaft. The shade is only a little warm, so the shafts
		// read as sunlight, not a beige page.
		vec3 gold = mix(vec3(0.28, 0.14, -0.1), vec3(0.3, 0.22, -0.04), smoothstep(0.3, 0.9, light));
		vec3 glow = light * gold + spill * vec3(0.12, 0.06, -0.04);
		vec3 tinted = glow - shade * vec3(0.84, 0.97, 1.18);

		// Dither so the slow gradients don't band in 8 bits.
		float dither = (hash21(gl_FragCoord.xy + fract(u_time) * 61.0) - 0.5) / 255.0;
		gl_FragColor = vec4(vec3(0.5) + 0.5 * tinted + dither, 1.0);
	}
`;

const DUST_VERTEX = /* glsl */ `
	precision highp float;
	attribute vec4 a_mote; // x, y, diameter (CSS px), seed
	varying float v_glow;
	${SUNLIGHT_GLSL}

	void main() {
		vec2 p = a_mote.xy;
		float seed = a_mote.w;
		// Motes tumble, so they catch the light in flashes.
		float glint = 0.5 + 0.5 * sin(u_time * (0.7 + seed * 2.3) + seed * 40.0);
		// Big motes are close and out of focus: same light spread over more pixels.
		float focus = 3.0 / max(a_mote.z, 3.0);
		v_glow = sunlight(p) * mix(0.25, 1.0, glint * glint) * focus;
		gl_Position = vec4(p / u_viewport * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
		gl_PointSize = a_mote.z;
	}
`;

const DUST_FRAGMENT = /* glsl */ `
	precision mediump float;
	varying float v_glow;

	void main() {
		float r = length(gl_PointCoord - 0.5) * 2.0;
		float disc = 1.0 - smoothstep(0.3, 1.0, r);
		gl_FragColor = vec4(vec3(1.0, 0.9, 0.7) * disc * v_glow * 1.3, 0.0);
	}
`;

interface Motes {
	/** x, y, diameter, seed per mote; uploaded as-is. */
	readonly attributes: Float32Array;
	readonly velocities: Float32Array;
	readonly depths: Float32Array;
	readonly count: number;
}

interface Pointer {
	x: number;
	y: number;
	vx: number;
	vy: number;
	lastMove: number;
}

function createMotes(width: number, height: number): Motes {
	const count = Math.round(Math.min(220, Math.max(70, (width * height) / 8000)));
	const attributes = new Float32Array(count * 4);
	const velocities = new Float32Array(count * 2);
	const depths = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		// Most motes are far and tiny; a few drift close to the eye.
		const depth = Math.random() ** 3;
		depths[i] = depth;
		attributes[i * 4] = Math.random() * width;
		attributes[i * 4 + 1] = Math.random() * height;
		attributes[i * 4 + 2] = 2 + depth * 12 + Math.random() * 1.5;
		attributes[i * 4 + 3] = Math.random();
	}
	return { attributes, velocities, depths, count };
}

function stepMotes(
	motes: Motes,
	dt: number,
	time: number,
	width: number,
	height: number,
	pointer: Pointer,
	scrollDelta: number,
): void {
	const { attributes: a, velocities: v, depths, count } = motes;
	const settle = 1 - Math.exp(-dt * 0.7);
	const stirring = time - pointer.lastMove < 0.12;
	const margin = 20;

	for (let i = 0; i < count; i++) {
		const depth = depths[i];
		const x = a[i * 4];
		const y = a[i * 4 + 1];
		const parallax = 0.5 + depth * 1.5;

		// Slow convection: a lazy sideways current that changes with height.
		const currentX = (2.2 + Math.sin(y * 0.006 + time * 0.13) * 3.2) * parallax;
		const currentY = (1.2 + Math.cos(x * 0.005 + time * 0.09) * 2.2) * parallax;

		let vx = v[i * 2] + (currentX - v[i * 2]) * settle + (Math.random() - 0.5) * 14 * dt;
		let vy = v[i * 2 + 1] + (currentY - v[i * 2 + 1]) * settle + (Math.random() - 0.5) * 14 * dt;

		// A hand waved through the beam pushes the air along with it.
		if (stirring) {
			const dx = x - pointer.x;
			const dy = y - pointer.y;
			const distance = Math.hypot(dx, dy);
			if (distance < STIR_RADIUS_PX) {
				const falloff = (1 - distance / STIR_RADIUS_PX) ** 2;
				vx += pointer.vx * falloff * 0.035;
				vy += pointer.vy * falloff * 0.035;
			}
		}

		// The sliding sheet drags the air above it a little.
		vy -= scrollDelta * 0.1 * parallax;

		v[i * 2] = vx;
		v[i * 2 + 1] = vy;

		let nx = x + vx * dt;
		let ny = y + vy * dt;
		if (nx > width + margin) nx = -margin;
		else if (nx < -margin) nx = width + margin;
		if (ny > height + margin) ny = -margin;
		else if (ny < -margin) ny = height + margin;
		a[i * 4] = nx;
		a[i * 4 + 1] = ny;
	}
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("atmosphere: could not create shader");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(`atmosphere: shader failed to compile: ${gl.getShaderInfoLog(shader)}`);
	}
	return shader;
}

function link(gl: WebGLRenderingContext, vertex: string, fragment: string): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new Error("atmosphere: could not create program");
	gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
	gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(`atmosphere: program failed to link: ${gl.getProgramInfoLog(program)}`);
	}
	return program;
}

interface Renderer {
	draw(width: number, height: number, time: number, motes: Motes): void;
}

/** Everything that lives on the GPU, so it can be rebuilt after a context loss. */
function createRenderer(gl: WebGLRenderingContext): Renderer {
	const lightProgram = link(gl, LIGHT_VERTEX, LIGHT_FRAGMENT);
	const dustProgram = link(gl, DUST_VERTEX, DUST_FRAGMENT);

	const corners = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, corners);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	const dustBuffer = gl.createBuffer();

	const light = {
		corner: gl.getAttribLocation(lightProgram, "a_corner"),
		viewport: gl.getUniformLocation(lightProgram, "u_viewport"),
		time: gl.getUniformLocation(lightProgram, "u_time"),
	};
	const dust = {
		mote: gl.getAttribLocation(dustProgram, "a_mote"),
		viewport: gl.getUniformLocation(dustProgram, "u_viewport"),
		time: gl.getUniformLocation(dustProgram, "u_time"),
	};

	return {
		draw(width, height, time, motes) {
			gl.viewport(0, 0, width, height);

			gl.disable(gl.BLEND);
			gl.useProgram(lightProgram);
			gl.uniform2f(light.viewport, width, height);
			gl.uniform1f(light.time, time);
			gl.bindBuffer(gl.ARRAY_BUFFER, corners);
			gl.enableVertexAttribArray(light.corner);
			gl.vertexAttribPointer(light.corner, 2, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			gl.disableVertexAttribArray(light.corner);

			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.useProgram(dustProgram);
			gl.uniform2f(dust.viewport, width, height);
			gl.uniform1f(dust.time, time);
			gl.bindBuffer(gl.ARRAY_BUFFER, dustBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, motes.attributes, gl.DYNAMIC_DRAW);
			gl.enableVertexAttribArray(dust.mote);
			gl.vertexAttribPointer(dust.mote, 4, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.POINTS, 0, motes.count);
			gl.disableVertexAttribArray(dust.mote);
		},
	};
}

/**
 * Starts the atmosphere on `canvas` and sets `data-lit` on it once the first
 * frame is drawn, so CSS can fade it in. Without WebGL the page stays plain paper.
 */
export function startAtmosphere(canvas: HTMLCanvasElement): void {
	const gl = canvas.getContext("webgl", {
		antialias: false,
		depth: false,
		stencil: false,
		powerPreference: "low-power",
	});
	if (!gl) return;

	const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let renderer = createRenderer(gl);

	// Sized from the canvas itself, which follows the fixed layer the page sees.
	let width = canvas.clientWidth;
	let height = canvas.clientHeight;
	const motes = createMotes(width, height);
	const pointer: Pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, lastMove: -1 };
	let lastScrollY = window.scrollY;
	let pendingScroll = 0;

	const start = performance.now();
	// Start a little way into the cycle so the first frame is not the same every visit.
	const timeOffset = Math.random() * 600;
	let previous = start;
	let lastFrame = -Infinity;
	let frame = 0;

	const resize = (): void => {
		const nextWidth = canvas.clientWidth;
		const nextHeight = canvas.clientHeight;
		// A new width means a real resize or a rotation, so spread the dust over
		// the new space. A height-only change is usually a phone's toolbar
		// sliding away mid-scroll, where moving the dust would show.
		if (nextWidth !== width) {
			const sx = nextWidth / width;
			const sy = nextHeight / height;
			for (let i = 0; i < motes.count; i++) {
				motes.attributes[i * 4] *= sx;
				motes.attributes[i * 4 + 1] *= sy;
			}
		}
		width = nextWidth;
		height = nextHeight;
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}
	};

	const draw = (time: number): void => {
		if (gl.isContextLost()) return;
		// Resizing clears the canvas, so it happens right before drawing.
		resize();
		renderer.draw(width, height, time, motes);
		canvas.dataset.lit = "";
	};

	const tick = (now: number): void => {
		frame = requestAnimationFrame(tick);
		if (now - lastFrame < FRAME_INTERVAL_MS - FRAME_SLACK_MS) return;
		lastFrame = now;
		const dt = Math.min(MAX_STEP_S, (now - previous) / 1000);
		previous = now;
		const seconds = (now - start) / 1000;
		stepMotes(motes, dt, seconds, width, height, pointer, pendingScroll);
		pendingScroll = 0;
		draw(seconds + timeOffset);
	};

	const run = (): void => {
		if (still) draw(timeOffset);
		else frame = requestAnimationFrame(tick);
	};

	const onPointerMove = (event: PointerEvent): void => {
		const now = (performance.now() - start) / 1000;
		const dt = Math.max(now - pointer.lastMove, 1 / 120);
		if (now - pointer.lastMove < 0.25) {
			pointer.vx = (event.clientX - pointer.x) / dt;
			pointer.vy = (event.clientY - pointer.y) / dt;
		}
		pointer.x = event.clientX;
		pointer.y = event.clientY;
		pointer.lastMove = now;
	};

	const onScroll = (): void => {
		pendingScroll += window.scrollY - lastScrollY;
		lastScrollY = window.scrollY;
	};

	// Mobile browsers drop GPU contexts when a tab goes to the background.
	canvas.addEventListener("webglcontextlost", (event) => {
		// Tells the browser we will rebuild, so it restores the context.
		event.preventDefault();
		cancelAnimationFrame(frame);
		delete canvas.dataset.lit;
	});
	canvas.addEventListener("webglcontextrestored", () => {
		renderer = createRenderer(gl);
		run();
	});

	if (still) {
		window.addEventListener("resize", () => draw(timeOffset));
	} else {
		window.addEventListener("pointermove", onPointerMove, { passive: true });
		window.addEventListener("scroll", onScroll, { passive: true });
	}
	run();
}
