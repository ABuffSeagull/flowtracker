import {
	createEffect,
	createSignal,
	createMemo,
	Show,
	For,
	createResource,
	onCleanup,
} from "solid-js";
import * as v from "valibot";
import { openDB, type DBSchema } from "idb";

interface TaskDB extends DBSchema {
	tasks: {
		value: {
			name: string;
			start: bigint;
			end: bigint;
			interrupted: boolean;
			breakDuration: number;
		};
		key: number;
	};
}

const taskSchema = v.object({
	name: v.string(),
	start: v.instance(Temporal.Instant),
	end: v.optional(v.instance(Temporal.Instant)),
});
type Task = v.InferOutput<typeof taskSchema>;

const db = await openDB<TaskDB>("flowtracker", undefined, {
	upgrade(db) {
		db.createObjectStore("tasks", {
			autoIncrement: true,
			keyPath: "id",
		});
	},
});

export default function App() {
	let dialog!: HTMLDialogElement;

	const [task, setTask] = createSignal<Task | undefined>(undefined);

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

	const [grouped, { refetch }] = createResource(async () => {
		const tasks = await db.getAll("tasks");
		const hydrated = tasks
			.map((task) => ({
				...task,
				start: Temporal.Instant.fromEpochNanoseconds(task.start),
				end: Temporal.Instant.fromEpochNanoseconds(task.end),
				breakDuration: Temporal.Duration.from({
					nanoseconds: task.breakDuration,
				}),
			}))
			.sort((a, b) => Temporal.Instant.compare(b.start, a.start));
		const nowZone = Temporal.Now.zonedDateTimeISO();
		return Map.groupBy(hydrated, (task) =>
			Temporal.PlainDate.from(task.start.toZonedDateTimeISO(nowZone)).toJSON(),
		);
	});

	async function onFinish() {
		const t = task();
		if (t) {
			const end = Temporal.Now.instant();
			await db.put("tasks", {
				name: t.name,
				start: t.start.epochNanoseconds,
				end: Temporal.Now.instant().epochNanoseconds,
				interrupted: false,
				breakDuration: t.start.until(end).nanoseconds,
			});
			setTask(undefined);
			await refetch();
		}
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
														{entry.end.toLocaleString(undefined, {
															timeStyle: "short",
														})}
													</td>
													<td>
														{entry.end
															.since(entry.start)
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
				<Show when={task()}>
					<div class="stats place-self-center">
						<div class="stat">
							<div class="stat-title">Name</div>
							<div class="stat-value">{task()?.name}</div>
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
								<Countup start={task()!.start} />
							</div>
							<span class="stat-desc">
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
