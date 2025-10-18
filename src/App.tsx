import {
	createEffect,
	createSignal,
	createMemo,
	For,
	createResource,
	onCleanup,
	Switch,
	Match,
} from "solid-js";
import * as v from "valibot";
import { openDB, type DBSchema } from "idb";
import type { TaggedUnion, Primitive } from "type-fest";
import { match } from "ts-pattern";

type Task = {
	name: string;
	start: Temporal.Instant;
	interrupted: boolean;
	end?: Temporal.Instant;
	breakDuration?: Temporal.Duration;
};

interface TaskDB extends DBSchema {
	tasks: {
		value: {
			[Key in keyof Task]: Task[Key] extends Primitive ? Task[Key] : string;
		};
		key: number;
	};
}

const dbPromise = openDB<TaskDB>("flowtracker", undefined, {
	upgrade(db) {
		db.createObjectStore("tasks", {
			autoIncrement: true,
			keyPath: "id",
		});
	},
});

type State = TaggedUnion<
	"type",
	{
		Running: { task: Task };
		Break: {};
		Empty: {};
	}
>;

export default function App() {
	let dialog!: HTMLDialogElement;

	const [state, setState] = createSignal<State>({ type: "Empty" });

	createEffect(() => {
		match(state())
			.with({ type: "Empty" }, () => {
				dialog.showModal();
			})
			.with({ type: "Running" }, { type: "Break" }, () => {})
			.exhaustive();
	});

	let form!: HTMLFormElement;

	function onSubmit() {
		const formData = new FormData(form);
		const name = v.parse(v.string(), formData.get("name"));

		setState({
			type: "Running",
			task: { name, start: Temporal.Now.instant(), interrupted: false },
		});
		form.reset();
	}

	const [grouped, { refetch }] = createResource(async () => {
		const db = await dbPromise;
		const tasks = await db.getAll("tasks");
		const hydrated: Array<Task> = tasks.map((task) => ({
			...task,
			start: Temporal.Instant.from(task.start),
			end: task.end != undefined ? Temporal.Instant.from(task.end) : undefined,
			breakDuration:
				task.breakDuration != undefined
					? Temporal.Duration.from(task.breakDuration)
					: undefined,
		}));
		const nowZone = Temporal.Now.zonedDateTimeISO();
		return Map.groupBy(hydrated, (task) =>
			Temporal.PlainDate.from(task.start.toZonedDateTimeISO(nowZone)).toJSON(),
		);
	});

	function onFinish() {
		match(state())
			.with({ type: "Running" }, async ({ task }) => {
				const end = Temporal.Now.instant();
				const db = await dbPromise;
				await db.put("tasks", {
					name: task.name,
					start: task.start.toJSON(),
					end: Temporal.Now.instant().toJSON(),
					interrupted: false,
					breakDuration: task.start.until(end).toJSON(),
				});
				setState({ type: "Empty" });
				await refetch();
			})
			.with({ type: "Empty" }, { type: "Break" }, () => {})
			.exhaustive();
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
			<div class="h-full grid grid-cols-[1fr_auto_1fr] p-5">
				<div class="h-full overflow-y-auto">
					<table class="table table-zebra table-pin-rows">
						<For each={Array.from(grouped()?.entries() ?? [])}>
							{([groupDate, entries]) => (
								<>
									<thead>
										<tr>
											<th>
												{Temporal.PlainDate.from(groupDate).toLocaleString(
													undefined,
													{ dateStyle: "medium" },
												)}
											</th>
											<th>Start</th>
											<th>End</th>
											<th>Duration</th>
											<th>Break Time</th>
										</tr>
									</thead>
									<tbody>
										<For each={entries}>
											{(entry) => (
												<tr>
													<td>{entry.name}</td>
													<td>
														{entry.start.toLocaleString(undefined, {
															timeStyle: "short",
														})}
													</td>
													<td>
														{entry.end?.toLocaleString(undefined, {
															timeStyle: "short",
														})}
													</td>
													<td>
														{entry.end
															?.since(entry.start)
															.round({
																largestUnit: "hours",
																smallestUnit: "seconds",
															})
															.toLocaleString(undefined, {
																timeStyle: "short",
															})}
													</td>
												</tr>
											)}
										</For>
									</tbody>
								</>
							)}
						</For>
					</table>
				</div>
				<div class="divider divider-horizontal" />
				<Switch>
					<Match when={state().type == "Running"}>
						<div class="stats place-self-center">
							<div class="stat">
								<div class="stat-title">Name</div>
								<div class="stat-value">{state().task.name}</div>
								<div class="stat-actions">
									<button
										type="button"
										class="btn btn-primary btn-xs btn-outline"
										on:click={onFinish}
									>
										Finish
									</button>
								</div>
							</div>
							<div class="stat">
								<span class="stat-title">Duration</span>
								<div class="stat-value">
									<Countup start={state().task.start} />
								</div>
								<span class="stat-desc">
									Started at{" "}
									{state().task.start.toLocaleString(undefined, {
										timeStyle: "short",
									})}
								</span>
							</div>
						</div>
					</Match>
				</Switch>
			</div>
		</>
	);
}

type CountupProps = {
	start: Temporal.Instant;
};

function Countup(props: CountupProps) {
	const [now, setNow] = createSignal(Temporal.Now.instant());

	const timer = setInterval(() => setNow(Temporal.Now.instant()), 1000);
	onCleanup(() => clearInterval(timer));

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
