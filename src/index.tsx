/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App.tsx";

if (!("Temporal" in globalThis)) {
	import("temporal-polyfill/global");
}

const root = document.getElementById("root");

render(() => <App />, root!);
