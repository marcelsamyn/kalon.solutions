import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

interface Props {
	title: string;
	subtitle: string;
	author: string;
	class?: string;
}

const SUBTITLE_MAX_CHARS_PER_LINE = 28;

function wrapText(text: string, maxChars: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length <= maxChars) {
			current = candidate;
		} else {
			if (current) lines.push(current);
			current = word;
		}
	}
	if (current) lines.push(current);
	return lines;
}

export const BookCover = component$<Props>(
	({ title, subtitle, author, class: className = "" }) => {
		const tiltRef = useSignal<HTMLDivElement>();
		const highlightRef = useSignal<HTMLDivElement>();
		const isPointerOver = useSignal(false);
		const pointerNX = useSignal(0);
		const pointerNY = useSignal(0);

		const subtitleLines = wrapText(subtitle, SUBTITLE_MAX_CHARS_PER_LINE);
		const SUBTITLE_LINE_HEIGHT = 24;
		const SUBTITLE_BLOCK_TOP = 348;
		const TITLE_TOP = 232;

		// eslint-disable-next-line qwik/no-use-visible-task
		useVisibleTask$(({ cleanup }) => {
			const tilt = tiltRef.value;
			const highlight = highlightRef.value;
			if (!tilt) return;

			const reduced = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			if (reduced) return;

			const MAX_ANGLE = 7;
			const PERIOD_Y_MS = 6200;
			const PERIOD_X_MS = 8400;
			const LERP = 0.08;
			const HIGHLIGHT_TRAVEL_PX = 14;

			let raf = 0;
			const start = performance.now();
			let cx = 0;
			let cy = 0;

			const tick = () => {
				const t = performance.now() - start;
				let tx: number;
				let ty: number;
				if (isPointerOver.value) {
					tx = pointerNY.value * MAX_ANGLE;
					ty = pointerNX.value * MAX_ANGLE;
				} else {
					ty = Math.sin((t / PERIOD_Y_MS) * Math.PI * 2) * MAX_ANGLE;
					tx = Math.cos((t / PERIOD_X_MS) * Math.PI * 2) * MAX_ANGLE * 0.55;
				}
				cx += (tx - cx) * LERP;
				cy += (ty - cy) * LERP;

				tilt.style.transform = `rotate(-2deg) rotateX(${cx.toFixed(2)}deg) rotateY(${cy.toFixed(2)}deg)`;
				if (highlight) {
					const dx = -cy * (HIGHLIGHT_TRAVEL_PX / MAX_ANGLE);
					const dy = cx * (HIGHLIGHT_TRAVEL_PX / MAX_ANGLE);
					highlight.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
				}

				raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
			cleanup(() => cancelAnimationFrame(raf));
		});

		return (
			<div
				class={className}
				style={{ perspective: "1400px" }}
				onPointerEnter$={() => {
					isPointerOver.value = true;
				}}
				onPointerLeave$={() => {
					isPointerOver.value = false;
					pointerNX.value = 0;
					pointerNY.value = 0;
				}}
				onPointerMove$={(event, el) => {
					const rect = el.getBoundingClientRect();
					const x = (event.clientX - rect.left) / rect.width - 0.5;
					const y = (event.clientY - rect.top) / rect.height - 0.5;
					pointerNX.value = Math.max(-0.5, Math.min(0.5, x)) * 2;
					pointerNY.value = -Math.max(-0.5, Math.min(0.5, y)) * 2;
				}}
			>
				<div
					ref={tiltRef}
					class="relative overflow-hidden rounded-sm shadow-[0_2px_4px_rgba(10,15,30,0.15),0_20px_40px_-12px_rgba(10,15,30,0.55),0_40px_80px_-30px_rgba(10,15,30,0.4)] ring-1 ring-black/20"
					style={{
						transform: "rotate(-2deg)",
						transformStyle: "preserve-3d",
						willChange: "transform",
					}}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 400 600"
						role="img"
						aria-label={`${title} book cover`}
						class="block h-auto w-full"
					>
						<defs>
							<linearGradient id="bc-bg" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0%" stop-color="#1c2540" />
								<stop offset="55%" stop-color="#131a2f" />
								<stop offset="100%" stop-color="#0a1020" />
							</linearGradient>
							<linearGradient id="bc-spine" x1="0" y1="0" x2="1" y2="0">
								<stop offset="0%" stop-color="#000" stop-opacity="0.35" />
								<stop offset="6%" stop-color="#000" stop-opacity="0" />
							</linearGradient>
							<radialGradient id="bc-glow" cx="0.3" cy="0.2" r="0.85">
								<stop offset="0%" stop-color="#c9a574" stop-opacity="0.18" />
								<stop offset="60%" stop-color="#c9a574" stop-opacity="0" />
							</radialGradient>
							<filter id="bc-grain">
								<feTurbulence
									type="fractalNoise"
									baseFrequency="0.9"
									numOctaves="2"
								/>
								<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0" />
							</filter>
						</defs>

						<rect width="400" height="600" fill="url(#bc-bg)" />
						<rect width="400" height="600" fill="url(#bc-glow)" />
						<rect width="400" height="600" filter="url(#bc-grain)" />
						<rect width="400" height="600" fill="url(#bc-spine)" />

						<rect
							x="24"
							y="24"
							width="352"
							height="552"
							fill="none"
							stroke="#c9a574"
							stroke-opacity="0.35"
							stroke-width="1"
						/>
						<line
							x1="180"
							y1="92"
							x2="220"
							y2="92"
							stroke="#c9a574"
							stroke-opacity="0.6"
							stroke-width="1"
						/>

						<text
							x="200"
							y={TITLE_TOP}
							text-anchor="middle"
							font-family="Lora, Georgia, serif"
							font-weight="600"
							font-size="46"
							fill="#f0e6d0"
							letter-spacing="0.5"
						>
							{title.split(/\s+/).map((word, i) => (
								<tspan key={i} x="200" dy={i === 0 ? 0 : 56}>
									{word}
								</tspan>
							))}
						</text>

						<line
							x1="170"
							y1={TITLE_TOP + 86}
							x2="230"
							y2={TITLE_TOP + 86}
							stroke="#c9a574"
							stroke-opacity="0.55"
							stroke-width="1"
						/>

						<text
							x="200"
							y={SUBTITLE_BLOCK_TOP}
							text-anchor="middle"
							font-family="Lora, Georgia, serif"
							font-style="italic"
							font-size="17"
							fill="#d9c8a3"
							letter-spacing="0.3"
						>
							{subtitleLines.map((line, i) => (
								<tspan
									key={i}
									x="200"
									dy={i === 0 ? 0 : SUBTITLE_LINE_HEIGHT}
								>
									{line}
								</tspan>
							))}
						</text>

						<text
							x="200"
							y="538"
							text-anchor="middle"
							font-family="Lora, Georgia, serif"
							font-size="14"
							fill="#c9a574"
							letter-spacing="3"
						>
							{author.toUpperCase()}
						</text>
					</svg>

					<div
						ref={highlightRef}
						aria-hidden="true"
						class="pointer-events-none absolute inset-0 mix-blend-screen"
						style={{
							background:
								"radial-gradient(ellipse 95% 120% at 28% 18%, rgba(255,236,200,0.18) 0%, rgba(255,236,200,0.10) 25%, rgba(255,236,200,0.04) 55%, rgba(255,236,200,0) 85%)",
							willChange: "transform",
						}}
					/>
				</div>
			</div>
		);
	},
);
