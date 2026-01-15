import { component$, useSignal } from "@builder.io/qwik";

export const ContactButton = component$(() => {
	const isOpen = useSignal(false);
	const isSubmitted = useSignal(false);

	return (
		<div class="relative">
			<button
				type="button"
				onClick$={() => {
					isOpen.value = !isOpen.value;
					isSubmitted.value = false;
				}}
				class="group inline-flex items-center gap-2 rounded-full border border-orange-700/40 bg-orange-500 px-6 py-3 font-medium text-white shadow-[inset_0_1px_1px_var(--color-orange-300)/50%,inset_0_-1px_2px_var(--color-orange-800)/30%,0_4px_16px_var(--color-orange-500)/30%] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_2px_2px_var(--color-orange-200)/60%,inset_0_-1px_2px_var(--color-orange-800)/30%,0_8px_24px_var(--color-orange-400)/40%]"
			>
				Let's talk
				<span
					class="transition-transform duration-300 group-hover:translate-x-1"
					style={{ transform: isOpen.value ? "rotate(45deg)" : undefined }}
				>
					→
				</span>
			</button>

			{isOpen.value && (
				<>
					{/* Backdrop */}
					<div
						class="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm md:hidden"
						onClick$={() => (isOpen.value = false)}
					/>

					{/* Popover */}
					<div class="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl md:absolute md:inset-auto md:bottom-auto md:left-0 md:top-full md:mt-4 md:w-80">
						{isSubmitted.value ? (
							<div class="py-4 text-center">
								<p class="font-serif text-xl text-blue-700">Thank you!</p>
								<p class="mt-2 text-gray-600">I'll get back to you soon.</p>
							</div>
						) : (
							<form
								name="contact"
								method="POST"
								data-netlify="true"
								onSubmit$={(e) => {
									e.preventDefault();
									const form = e.target as HTMLFormElement;
									const formData = new FormData(form);

									fetch("/", {
										method: "POST",
										headers: { "Content-Type": "application/x-www-form-urlencoded" },
										body: new URLSearchParams(formData as unknown as Record<string, string>).toString(),
									}).then(() => {
										isSubmitted.value = true;
									});
								}}
							>
								<input type="hidden" name="form-name" value="contact" />

								<div class="space-y-4">
									<div>
										<label for="name" class="block text-sm font-medium text-gray-700">
											Name
										</label>
										<input
											type="text"
											id="name"
											name="name"
											required
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
											placeholder="Your name"
										/>
									</div>

									<div>
										<label for="email" class="block text-sm font-medium text-gray-700">
											Email
										</label>
										<input
											type="email"
											id="email"
											name="email"
											required
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
											placeholder="you@example.com"
										/>
									</div>

									<div>
										<label for="message" class="block text-sm font-medium text-gray-700">
											Message
										</label>
										<textarea
											id="message"
											name="message"
											rows={3}
											required
											class="mt-1 block w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
											placeholder="What's on your mind?"
										/>
									</div>

									<button
										type="submit"
										class="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
									>
										Send message
									</button>
								</div>
							</form>
						)}
					</div>
				</>
			)}
		</div>
	);
});
