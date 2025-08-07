import "temporal-polyfill/global";
import { Elm } from "./elm.js";
import { register } from "component-register";

Elm.Main.init({
	node: document.querySelector("#root"),
	flags: { width: window.innerWidth, height: window.innerHeight },
});

register("format-duration", {
	duration: {
		value: 0,
		parse: true,
	},
})((props, { element }) => {
	function display(name: string, val: any) {
		element.textContent = Temporal.Duration.from({ milliseconds: val })
			.round({ smallestUnit: "second", largestUnit: "hour" })
			.toLocaleString(undefined, { style: "long" });
	}
	element.addPropertyChangedCallback(display);
	display("duration", props.duration);
});

register("format-instant", {
	instant: {
		value: 0,
		parse: true,
	},
})((props, { element }) => {
	function display(name: string, val: any) {
		element.textContent = Temporal.Instant.fromEpochMilliseconds(
			val,
		).toLocaleString(undefined, { style: "long" });
	}
	element.addPropertyChangedCallback(display);
	display("instant", props.instant);
});
