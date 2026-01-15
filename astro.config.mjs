// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import qwikdev from "@qwikdev/astro";

// https://astro.build/config
export default defineConfig({
	integrations: [qwikdev()],
	vite: {
		plugins: [tailwindcss()],
	},
});
