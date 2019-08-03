import { isFunction, isAsyncGenerator } from "../utilities";

const TASK_ASYNC = Symbol("taskAsync");
const CATCHER = Symbol("catcher");
const FINALIZER = Symbol("finally");

/**
 *
 *
 * @param taskAsync The generator function to execute
 */
const performAsync = function performAsync(taskAsync) {

	if (!isAsyncGenerator(taskAsync)) {
		throw TypeError(`${taskAsync} is not an async generator function`)
	}

	// create an object that is prototype linked with the 'performAsync.prototype' object
	const _this = Object.create(performAsync.prototype);

	// store the generator privately inside that object
	_this[TASK_ASYNC] = taskAsync;

	// return that object
	return _this;
}

// the objects generated by 'performAsync' will have only one method: the 'catch' method
// this avoid weird 'finally' or 'try' calls without a proper 'catch' call

// do you know about hoisting? :P
performAsync.prototype.catch = _catch;

/**
 *
 *
 * @param catcher The function responsible of handling errors
 * @returns An object that let you start the computation or add a finalizer function
 */
function _catch(catcher) {

	if (!isFunction(catcher)) {
		throw TypeError(`${catcher} is not a function`)
	}

	// store the catcher fn privately
	this[CATCHER] = catcher;

	// when the 'try' method is invoked, the async generator must start
	const tryFn = async () => await run.call(this);

	// this avoid weird 'finally' or 'try' calls without a proper 'catch' call
	// and avoid subsequents 'catch' calls
	return {

		finally: finalizer => {

			if (!isFunction(finalizer)) {
				throw TypeError(`${finalizer} is not a function`)
			}

			// store the finalizer fn privately
			this[FINALIZER] = finalizer;

			// after callinf the 'finally' method we can only start the async generator
			return {
				try: tryFn
			}
		},

		// calling the 'finally' method is not mandatory, the async generator could be started without it
		try: tryFn
	}
}

/**
 *
 * @param this Always an object created by performAsync->catch || performAsync->catch->finally chains
 * *
 */
async function run() {

	// start the majestic generator
	const ait = this[TASK_ASYNC]();

	// it will store the IteratorResult
	let next;
	// it will store value contained into the IteratorResult or the value inserted with 'recoverFn'
	let value;

	// some bool-ish flags to make my life easier and a counter
	const flowFlags = {
		retry: false,
		recover: false,
		restart: false
	}
	const retryNTimes = { value: 0 };

	// nop
	const nop = () => { };
	// this function could be be called when an error has occurred inside a yielded computation
	// to retry N times the computation
	const retryFn = (n = 1) => {
		if (!(typeof n === "number") || Number.isNaN(n)) {
			throw new TypeError(`${n} is not a valid argument for the retry function`)
		}
		retryNTimes.value = n;
		flowFlags.retry = true;
	}
	// this function could be be called when an error has occurred inside a yielded computation
	// to recover the main task (the async generator)
	const recoverFn = v => (value = v, flowFlags.recover = true);
	// this function could be called after any error to restart the main task (the async generator)
	const restartFn = () => (flowFlags.restart = true);

	// the rare do-while loop
	do {
		try {
			// we feed the async generator with the last AsyncIteratorResult value
			// at the first iteration,'value' will be undefined but generators do ignore
			// the first inserted value
			next = await ait.next(value);
		} catch (error) {
			// if an error has occurred during the n-th iteration of the
			// generator, it means that the error was not thrown from a yielded computation,
			// but from the generator itself
			// So the current instance of the generator is no more usable, we can only restart it
			this[CATCHER](
				{ error, isRecoverable: false },
				{ retry: nop, recover: nop, restart: restartFn }
			);

			if (flowFlags.restart) {
				return await run.call(this); // loving TCO
			}

			// if the 'restartFn' was not called, it means that the generator should not be restarted
			// we cannot do anything except call the 'finalizer' function
			this[FINALIZER] && this[FINALIZER]();
			return;
		}

		// if no errors have occurred during the n-th iteration of the generator,
		// something was yielded out
		// usually it should be a delayed computation, but...
		const expr = isFunction(next.value) ? next.value : (() => next.value);

		try {
			// evaluate the delayed expression
			// if everything went well this value will be inserted into
			// the generators during the next iteration
			value = await expr();
		} catch (error) {

			// what about errors inside yielded computations?
			// them will be recoverable, because thanks to the 'yield' keyword we can insert
			// a rescue value inside the generator in their place and by deferring the computation inside an arrow function
			// we are able to retry it

			const _value = await handleRecoverableError.call(this, { flowFlags, retryNTimes }, { expr, error, retryFn, recoverFn, restartFn });

			// if we want we can restart the whole generator
			if (flowFlags.restart) {
				return await run.call(this);
			}

			// or we can recover from the error
			// remember that the 'recoverFn' will set the 'value' to be inserted inside the generator
			// into the next iteration
			if (flowFlags.recover) {
				flowFlags.recover = false;
				retryNTimes.value = 0;
				continue;
			}

			// or we can use the new recomputed value
			if (flowFlags.retry) {
				flowFlags.retry = false;
				value = _value;
				retryNTimes.value = 0;
				continue;
			}

			// if the 'restartFn' and the 'recoverFn' and the 'retryFn' were not called, it means that the generator
			// should not be recovered nor restarted: we cannot do anything except call the 'finalizer' function
			this[FINALIZER] && this[FINALIZER]();
			return;
		}
	} while (!next.done);


	// also when the generator ends successfully we should call the 'finalizer'
	this[FINALIZER] && this[FINALIZER]();
	return;

}

async function handleRecoverableError({ flowFlags, retryNTimes }, { expr, error, retryFn, recoverFn, restartFn }) {

	this[CATCHER](
		{ error, isRecoverable: true },
		{ retry: retryFn, recover: recoverFn, restart: restartFn },
	);

	// if the 'restartFn' was called, the only flag that should be set to true is the restart one
	// but it is already true because of the 'restartFn' call
	if (flowFlags.restart) {
		return;
	}

	// if the 'recoverFn' was called, the only flag that should be set to true is the recover one
	// but it is already true because of the 'recoverFn' call
	// the value for the next iteration has been set inside the 'run' function by the 'recoverFn'
	if (flowFlags.recover) {
		return;
	}

	// if the 'retryFn' was called we have to retry the failed computation 'retryNTimes.value' times
	if (flowFlags.retry && retryNTimes.value) {
		let error = null;
		let value = null;

		while (retryNTimes.value > 0) {
			try {
				value = await expr();
				error = null;
				break;
			} catch (e) {
				error = e;
			}

			retryNTimes.value--;
		}

		// if all attempts have failed
		// we have to call the catch function again with the new error
		if (error) {
			return await handleRecoverableError.call(this, { flowFlags, retryNTimes }, { expr, error, retryFn, recoverFn, restartFn });
		} else {
			// if one of the attempt was right, we return the value of the computation
			return value;
		}
	}

	// if the 'restartFn' and the 'recoverFn' and the 'retryFn' were not called, it means that the generator
	// should not be recovered nor restarted
	flowFlags.restart = false;
	flowFlags.retry = false;
	flowFlags.recover = false;
	return;
}

// hoping you're doing well
export { performAsync };