import { createEffect } from "solid-js";

export default function App() {
	let dialog!: HTMLDialogElement;

	createEffect(() => {
		dialog.showModal();
	});

	let form!: HTMLFormElement;

	function onSubmit() {
		console.log(new FormData(form));
	}

	return (
		<>
			<dialog class="modal" ref={dialog}>
				<div class="modal-box">
					<h2 class="text-xl capitalize font-bold">Start new task</h2>
					<form method="dialog" ref={form} on:submit={onSubmit}>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Name</legend>
							<input type="text" name="name" class="input" />
						</fieldset>
						<div class="modal-action">
							<button type="submit" class="btn">
								Start
							</button>
						</div>
					</form>
				</div>
			</dialog>
		</>
	);
}
