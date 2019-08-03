const { performAsync } = require("../src/index");

const delay = ms => new Promise(ok => setTimeout(ok, ms));

test('should pass', () => {
	expect(true).toBe(true);
});

describe("performAsync", () => {

	test('the returned object from \'performAsync\' function call should have a catch method', () => {

		const uncompleted = performAsync(async function* () { });

		expect(uncompleted.catch).toBeInstanceOf(Function);
	});

	test('all the jobs should complete successfully', async () => {

		const mockFn = jest.fn();

		await performAsync(async function* () {
			mockFn();
			mockFn();
			mockFn();
		})
			.catch(() => { })
			.try();

		expect(mockFn).toHaveBeenCalledTimes(3);
	});


});

describe("catch", () => {

	test('the returned object from \'catch\' method call should have a try method', () => {


		const uncompleted = performAsync(async function* () { }).catch(() => { });

		expect(uncompleted.try).toBeInstanceOf(Function);
	});

	test('the returned object from \'catch\' method call should have a finally method', () => {


		const uncompleted = performAsync(async function* () { }).catch(() => { });

		expect(uncompleted.finally).toBeInstanceOf(Function);
	});

	test('should not start the execution because the try method was not called', () => {


		const mockFn = jest.fn();

		performAsync(async function* () { mockFn(); }).catch(() => { });

		expect(mockFn).not.toHaveBeenCalled();
	});

	test('the catcher function should not be called', async () => {


		const work = () => { };
		const mockedCatcher = jest.fn();

		await performAsync(async function* () {
			work();
		})
			.catch(mockedCatcher)
			.try();

		expect(mockedCatcher).not.toHaveBeenCalled();
	});

	test('the catcher function should receive two arguments', async () => {


		const work = () => { throw 3 };

		await performAsync(async function* () {
			work();
		})
			.catch((...args) => {
				expect(args.length).toBe(2);
			})
			.try();

	});

	test('the first argument received by the catcher function should be an object with two field: {error, isRecoverable}', done => {


		const work = () => { throw 3 };

		performAsync(async function* () {
			work();
		})
			.catch(({ error, isRecoverable }) => {
				expect(error).toBeDefined();
				expect(isRecoverable).toBeDefined();
				done();
			})
			.try();
	});

	test('the error field should contain the thrown entity', async () => {

		{
			const entityToBeThrown = {};

			const work = () => { throw entityToBeThrown };

			await performAsync(async function* () {
				work();
			})
				.catch(({ error }) => {
					expect(error).toBe(entityToBeThrown);
				})
				.try();
		}

		{
			const entityToBeThrown = {};

			const work = async () => { throw entityToBeThrown };

			await performAsync(async function* () {
				yield () => work();
			})
				.catch(({ error }) => {
					expect(error).toBe(entityToBeThrown);
				})
				.try();
		}

	});

	test('the isRecoverable field should be true if an error was thrown by an yelded computation', async () => {


		{
			const entityToBeThrown = {};

			const work = () => { throw entityToBeThrown };

			await performAsync(async function* () {
				yield () => work();
			})
				.catch(({ isRecoverable }) => {
					expect(isRecoverable).toBe(true);
				})
				.try();
		}

	});

	test('the isRecoverable field should be false if an error was thrown by the generator', async () => {


		{
			const entityToBeThrown = {};

			const work = () => { throw entityToBeThrown };

			await performAsync(async function* () {
				work();
			})
				.catch(({ isRecoverable }) => {
					expect(isRecoverable).toBe(false);
				})
				.try();
		}

	});

	test('the second argument received by the catcher function should be an object containing three functions: {recover, retry, restart}', async () => {


		const work = () => { throw 3 };


		await performAsync(async function* () {
			work();
		})
			.catch((_, { recover, retry, restart }) => {
				expect(recover).toBeInstanceOf(Function);
				expect(retry).toBeInstanceOf(Function);
				expect(restart).toBeInstanceOf(Function);
			})
			.try();
	});



	test('when an error is thrown by a yielded computation, the retry function should reevaluate it', async () => {

		let alreadyCalled = false;
		const work = jest.fn(() => { throw 3 });

		await performAsync(async function* () {
			yield () => work();
		})
			.catch((_, { retry }) => {
				if (!alreadyCalled) {
					retry();
					alreadyCalled = true;
				}
			})
			.try();

		expect(work).toHaveBeenCalledTimes(2);
	});

	test('when an error is thrown by a yielded computation, passing a numeric value (N) to the the retry function should reevaluate it\
	at most N times until it succeeds ', async () => {


			let counter = 0;
			const work = jest.fn(() => {
				if (counter++ < 3) {
					throw 3
				}
			});

			await performAsync(async function* () {
				yield () => work();
			})
				.catch((_, { retry }) => {
					retry(10);
				})
				.try();

			expect(work).toHaveBeenCalledTimes(4); // the initial + 3

		});

	test('when an error is thrown by a yielded computation, if a retried computation have success its resulting value should be insterted back into the generator', async () => {

		let counter = 0;
		const value = [];

		const mockFn = jest.fn();

		const work = async function mayThrow() {
			await delay(200);
			if (counter++ < 3) {
				throw new Error();
			} else {
				return value;
			}
		}

		await performAsync(async function* () {
			const res = await (yield () => work());
			mockFn(res);
		})
			.catch((_, { retry }) => {
				retry(Infinity);
			})
			.try();

		expect(mockFn).toHaveBeenCalledWith(value);

	});



	test('when an error is thrown by a yielded computation, passing a numeric value (N) to the the retry function should reevaluate it\
	at most N times before calling again the catcher function in case of N failures', async () => {


			let alreadyCalled = false;
			const work = jest.fn(() => { throw 3 });
			const catcher = jest.fn((_, { retry }) => {
				if (!alreadyCalled) {
					retry(5);
					alreadyCalled = true;
				}
			})

			await performAsync(async function* () {
				yield async () => await work();
			})
				.catch(catcher)
				.try();

			expect(work).toHaveBeenCalledTimes(6); // the initial + 5
			expect(catcher).toHaveBeenCalledTimes(2);
		});

	test('when an error is thrown by the generator, calling the retry function should have no effect', async () => {


		const work = async () => { delay(200); throw 3; };
		const mockFn = jest.fn();

		await performAsync(async function* () {
			await work();
			mockFn();
		})
			.catch((_, { retry }) => {
				retry();
			})
			.try();

		expect(mockFn).not.toHaveBeenCalled();
	});



	test('when an error is thrown by a yielded computation, the recover function should allow continuation', async () => {


		const work = () => { throw 3 };
		const mockFn = jest.fn();

		await performAsync(async function* () {
			await (yield async () => await work());
			mockFn();
		})
			.catch((_, { recover }) => {
				recover();
			})
			.try();

		expect(mockFn).toHaveBeenCalled();
	});

	test('when an error is thrown by a yielded computation, the value passed to the recover function should be inserted inside the generator', async () => {


		const work = () => { throw 3 };
		const mockFn = jest.fn();
		const continuationValue = {};

		await performAsync(async function* () {
			mockFn(yield () => work());
		})
			.catch((_, { recover }) => {
				recover(continuationValue);
			})
			.try();

		expect(mockFn).toHaveBeenCalledWith(continuationValue);
	});

	test('when an error is thrown by the generator, calling the recover function should have no effect', async () => {


		const work = () => { throw 3 };
		const mockFn = jest.fn();

		await performAsync(async function* () {
			work();
			mockFn();
		})
			.catch((_, { recover }) => {
				recover();
			})
			.try();

		expect(mockFn).not.toHaveBeenCalled();
	});



	test('when an error is thrown by a yielded computation, calling restart will restart the generator', async () => {


		let alreadyCalled = false;
		const mockFn = jest.fn(() => { throw 3 });

		await performAsync(async function* () {
			yield () => mockFn();
		})
			.catch((_, { restart }) => {
				if (!alreadyCalled) {
					restart();
					alreadyCalled = true;
				}
			})
			.try();

		expect(mockFn).toHaveBeenCalledTimes(2);
	});

	test('when an error is thrown by the generator, calling restart will restart the generator', async () => {


		let alreadyCalled = false;
		const mockFn = jest.fn(() => { throw 3 });

		await performAsync(async function* () {
			mockFn();
		})
			.catch((_, { restart }) => {
				if (!alreadyCalled) {
					restart();
					alreadyCalled = true;
				}
			})
			.try();

		expect(mockFn).toHaveBeenCalledTimes(2);
	});

});


describe("finally", () => {
	test('the returned object from \'finally\' method call should have a try method', async () => {


		const uncompleted = performAsync(async function* () { }).catch(() => { }).finally(() => { });

		expect(uncompleted.try).toBeInstanceOf(Function);
	});

	test('should not start the execution because the try method was not called', async () => {


		const mockFn = jest.fn();

		await performAsync(async function* () { mockFn(); }).catch(() => { }).finally(() => { });

		expect(mockFn).not.toHaveBeenCalled();
	});

	test('the finalizer function should always be called at the end of the task if no error has occurred', async () => {


		const work = () => { };
		const mockedFinalizer = jest.fn();

		await performAsync(async function* () {
			work();
		})
			.catch(() => { })
			.finally(mockedFinalizer)
			.try();

		expect(mockedFinalizer).toHaveBeenCalled();
	});

	test('the finalizer function should always be called at the end of the catcher function when the task is not replayed', async () => {


		{
			const work = () => { throw 42 };
			const mockedFinalizer = jest.fn();

			await performAsync(async function* () {
				work();
			})
				.catch(() => { })
				.finally(mockedFinalizer)
				.try();

			expect(mockedFinalizer).toHaveBeenCalled();
		}

		{
			const work = () => { throw 42 };
			const mockedFinalizer = jest.fn();

			await performAsync(async function* () {
				yield () => work();
			})
				.catch(() => { })
				.finally(mockedFinalizer)
				.try();

			expect(mockedFinalizer).toHaveBeenCalled();
		}


	});

})




describe("try", () => {

	test('should start the execution after the catch method was called', async () => {


		const mockFn = jest.fn();

		await performAsync(async function* () { mockFn(); }).catch(() => { }).try();

		expect(mockFn).toHaveBeenCalled();
	});

	test('should start the execution after the finally method was called', async () => {


		const mockFn = jest.fn();

		await performAsync(async function* () { mockFn(); }).catch(() => { }).finally(() => { }).try();

		expect(mockFn).toHaveBeenCalled();
	});

});
