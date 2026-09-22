import { component$, useSignal, $ } from "@builder.io/qwik";

type Status = "idle" | "loading" | "success" | "error";

interface Props {
	action: string;
	contactEmail: string;
}

export const FollowAlongForm = component$<Props>(({ action, contactEmail }) => {
	const status = useSignal<Status>("idle");

	const handleSubmit = $(async (event: SubmitEvent, form: HTMLFormElement) => {
		event.preventDefault();
		status.value = "loading";
		try {
			await fetch(action, {
				method: "POST",
				mode: "no-cors",
				body: new FormData(form),
			});
			status.value = "success";
		} catch {
			status.value = "error";
		}
	});

	if (status.value === "success") {
		return (
			<p class="mt-6 text-base text-blue-700">
				Almost there. Confirm your email and the Introduction is on its way.
			</p>
		);
	}

	const isLoading = status.value === "loading";

	return (
		<div>
			<form
				action={action}
				method="POST"
				target="_blank"
				onSubmit$={handleSubmit}
				class="mt-6 flex flex-col gap-3 sm:flex-row"
			>
				<label class="sr-only" for="follow-email">
					Email
				</label>
				<input
					id="follow-email"
					type="email"
					name="fields[email]"
					required
					autocomplete="email"
					placeholder="you@example.com"
					class="flex-1 rounded-lg border border-gray-300 bg-white/60 px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>
				<input type="hidden" name="ml-submit" value="1" />
				<input type="hidden" name="anticsrf" value="true" />
				<button
					type="submit"
					disabled={isLoading}
					class="group inline-flex items-center justify-center gap-2 rounded-lg border border-orange-700/40 bg-orange-500 px-7 py-3 font-medium text-white shadow-[inset_0_1px_1px_var(--color-orange-300)/50%,inset_0_-1px_2px_var(--color-orange-800)/30%,0_4px_16px_var(--color-orange-500)/30%] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_2px_2px_var(--color-orange-200)/60%,inset_0_-1px_2px_var(--color-orange-800)/30%,0_8px_24px_var(--color-orange-400)/40%] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isLoading ? "Sending…" : "Get the Introduction"}
				</button>
			</form>
			{status.value === "error" && (
				<p class="mt-4 text-base text-orange-700">
					Something went wrong. Please try again, or email{" "}
					<a
						href={`mailto:${contactEmail}`}
						class="underline decoration-orange-300 underline-offset-2"
					>
						{contactEmail}
					</a>
					.
				</p>
			)}
		</div>
	);
});
