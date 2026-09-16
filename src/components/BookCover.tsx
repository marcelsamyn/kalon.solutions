import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

interface Props {
	class?: string;
}

// Rendered from the book repo's own Typst source, so the site and the book
// show the same cover. Regenerate it there rather than editing this file.
const COVER_SRC = "/book-cover.jpeg";

export const BookCover = component$<Props>(({ class: className = "" }) => {
	const tiltRef = useSignal<HTMLDivElement>();
	const highlightRef = useSignal<HTMLDivElement>();
	const isPointerOver = useSignal(false);
	const pointerNX = useSignal(0);
	const pointerNY = useSignal(0);

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
				<img
					src={COVER_SRC}
					alt="Sacred Struggle by Marcel Samyn — book cover"
					width={1200}
					height={1800}
					class="block h-auto w-full"
				/>

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
});
