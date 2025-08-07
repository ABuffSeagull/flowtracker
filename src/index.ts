import "temporal-polyfill/global";
import { Elm } from "./elm.js";
import { register } from "component-register";

Elm.Main.init({
	node: document.querySelector("#root"),
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
