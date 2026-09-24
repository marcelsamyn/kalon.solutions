import { component$, useSignal, $ } from "@builder.io/qwik";

type Status = "idle" | "loading" | "success" | "error";

interface Props {
	action: string;
	contactEmail: string;
	/** Unique per page, so repeated forms don't share input/error element ids. */
	formId: string;
}

interface SubscribeResponse {
	success?: boolean;
	errors?: { fields?: Record<string, string[]> };
}

export const FollowAlongForm = component$<Props>(
	({ action, contactEmail, formId }) => {
		const status = useSignal<Status>("idle");
		const emailError = useSignal<string>();
		const hasFormError = useSignal(false);

		const inputId = `${formId}-email`;
		const emailErrorId = `${formId}-email-error`;
		const formErrorId = `${formId}-form-error`;

		const handleSubmit = $(async (event: SubmitEvent, form: HTMLFormElement) => {
			event.preventDefault();
			if (status.value === "loading") return;

			status.value = "loading";
			emailError.value = undefined;
			hasFormError.value = false;

			try {
				const response = await fetch(action, {
					method: "POST",
					headers: { Accept: "application/json" },
					body: new FormData(form),
				});

				if (!response.ok) {
					throw new Error(`Subscription request failed: ${response.status}`);
				}

				const result = (await response.json()) as SubscribeResponse;
				const message = result.errors?.fields?.email?.[0];

				if (result.success === false) {
					if (message) {
						emailError.value = message;
					} else {
						hasFormError.value = true;
					}
					status.value = "error";
					return;
				}

				status.value = "success";
			} catch {
				hasFormError.value = true;
				status.value = "error";
			}
		});

		if (status.value === "success") {
			return (
				<p
					role="status"
					class="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-base text-blue-800"
				>
					Almost there. Confirm your email and the Introduction is on its way.
				</p>
			);
		}

		const isLoading = status.value === "loading";

		return (
			<div class="mt-6">
				<form
					action={action}
					method="POST"
					target="_blank"
					preventdefault:submit
					onSubmit$={handleSubmit}
					aria-busy={isLoading}
					class="flex flex-col gap-3 sm:flex-row"
				>
					<label class="sr-only" for={inputId}>
						Email
					</label>
					<input
						id={inputId}
						type="email"
						name="fields[email]"
						required
						autocomplete="email"
						placeholder="you@example.com"
						aria-invalid={emailError.value ? "true" : undefined}
						aria-describedby={emailError.value ? emailErrorId : undefined}
						onInput$={() => {
							if (status.value === "error") {
								status.value = "idle";
								emailError.value = undefined;
								hasFormError.value = false;
							}
						}}
						class={`flex-1 rounded-lg border bg-white/60 px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-1 ${
							emailError.value
								? "border-orange-400 focus:border-orange-500 focus:ring-orange-500"
								: "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
						}`}
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

				{emailError.value && (
					<p id={emailErrorId} role="alert" class="mt-2 text-sm text-orange-700">
						{emailError.value}
					</p>
				)}

				{hasFormError.value && (
					<p id={formErrorId} role="alert" class="mt-4 text-base text-orange-700">
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
	}
);
