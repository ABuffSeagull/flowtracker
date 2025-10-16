import { createEffect, createSignal, createMemo, Show } from "solid-js";
import * as v from "valibot";

const taskSchema = v.object({
	start: v.instance(Temporal.Instant),
	name: v.string(),
});
type Task = v.InferOutput<typeof taskSchema>;

export default function App() {
	let dialog!: HTMLDialogElement;

	const [task, setTask] = createSignal<Task | undefined>({
		name: "Foobar",
		start: Temporal.Now.instant(),
	});

	createEffect(() => {
		if (!task()) {
			dialog.showModal();
		}
	});

	let form!: HTMLFormElement;

	function onSubmit() {
		const formData = new FormData(form);

		setTask(
			v.parse(taskSchema, {
				start: Temporal.Now.instant(),
				name: formData.get("name") ?? "",
			}),
		);
	}

	return (
		<>
			<dialog class="modal" ref={dialog}>
				<div class="modal-box">
					<h2 class="text-xl capitalize font-bold mb-3">New task</h2>
					<form method="dialog" ref={form} on:submit={onSubmit}>
						<fieldset class="fieldset">
							<legend class="fieldset-legend">Task Name</legend>
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
			<div class="flex h-full items-center justify-center">
				<Show when={task()}>
					<div class="stats">
						<div class="stat">
							<div class="stat-title">Name</div>
							<div class="stat-value">{task()?.name}</div>
							<div class="stat-actions">
								<button
									type="button"
									class="btn btn-primary btn-xs btn-outline"
								>
									Finish
								</button>
							</div>
						</div>
						<div class="stat">
							<span class="stat-title">Duration</span>
							<div class="stat-value">
								<Countup start={task()!.start} />
							</div>
							<span class="stat-description">
								Started at{" "}
								{task()?.start.toLocaleString(undefined, {
									timeStyle: "short",
								})}
							</span>
						</div>
					</div>
				</Show>
			</div>
		</>
	);
}

type CountupProps = {
	start: Temporal.Instant;
};

function Countup(props: CountupProps) {
	const [now, setNow] = createSignal(Temporal.Now.instant());
	createEffect(() => {
		setInterval(() => setNow(Temporal.Now.instant()), 1000);
	});

	const duration = createMemo(() =>
		props.start
			.until(now())
			.round({ largestUnit: "hours", smallestUnit: "seconds" }),
	);
	const hours = () => duration()?.hours ?? 0;
	const minutes = () => duration()?.minutes ?? 0;
	const seconds = () => duration()?.seconds ?? 0;
	return (
		<span class="countdown font-mono">
			<span class="[--digits:2]" style={{ "--value": hours() }}>
				{hours()}
			</span>
			h
			<span class="[--digits:2]" style={{ "--value": minutes() }}>
				{minutes()}
			</span>
			m
			<span class="[--digits:2]" style={{ "--value": seconds() }}>
				{seconds()}
			</span>
			s
		</span>
	);
}
