const { perform } = require("../src/index");

test('should pass', () => {
	expect(true).toBe(true);
});

describe("perform", () => {

	test('the returned object from \'perform\' function call should have a catch method', () => {

		const uncompleted = perform(function* () { });

		expect(uncompleted.catch).toBeInstanceOf(Function);
	});

	test('all the jobs should complete successfully', () => {

		const mockFn = jest.fn();

		perform(function* () {
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

		const uncompleted = perform(function* () { }).catch(() => { });

		expect(uncompleted.try).toBeInstanceOf(Function);
	});

	test('the returned object from \'catch\' method call should have a finally method', () => {

		const uncompleted = perform(function* () { }).catch(() => { });

		expect(uncompleted.finally).toBeInstanceOf(Function);
	});

	test('should not start the execution because the try method was not called', () => {

		const mockFn = jest.fn();

		perform(function* () { mockFn(); }).catch(() => { });

		expect(mockFn).not.toHaveBeenCalled();
	});

	test('the catcher function should not be called', () => {

		const work = () => { };
		const mockedCatcher = jest.fn();

		perform(function* () {
			work();
		})
			.catch(mockedCatcher)
			.try();

		expect(mockedCatcher).not.toHaveBeenCalled();
	});

	test('the catcher function should receive three arguments', () => {

		const work = () => { throw 3 };

		perform(function* () {
			work();
		})
			.catch((...args) => {
				expect(args.length).toBe(3);
			})
			.try();

	});

	test('the first argument received by the catcher function should be an object with two field: {error, isRecoverable}', () => {

		const work = () => { throw 3 };

		perform(function* () {
			work();
		})
			.catch(({ error, isRecoverable }) => {
				expect(error).toBeDefined();
				expect(isRecoverable).toBeDefined();
			})
			.try();
	});

	test('the error field should contain the thrown entity', () => {

		{
			const entityToBeThrown = {};

			const work = () => { throw entityToBeThrown };

			perform(function* () {
				work();
			})
				.catch(({ error }) => {
					expect(error).toBe(entityToBeThrown);
				})
				.try();
		}

		{
			const entityToBeThrown = {};

			const work = () => { throw entityToBeThrown };

			perform(function* () {
				yield () => work();
			})
				.catch(({ error }) => {
					expect(error).toBe(entityToBeThrown);
				})
				.try();
		}

	});

	test('the isRecoverable field should be true if an error was thrown by an yelded computation', () => {

		{
			const entityToBeThrown = {};

			const work = () => { throw entityToBeThrown };

			perform(function* () {
				yield () => work();
			})
				.catch(({ isRecoverable }) => {
					expect(isRecoverable).toBe(true);
				})
				.try();
		}

	});

	test('the isRecoverable field should be false if an error was thrown by the generator', () => {

		{
			const entityToBeThrown = {};

			const work = () => { throw entityToBeThrown };

			perform(function* () {
				work();
			})
				.catch(({ isRecoverable }) => {
					expect(isRecoverable).toBe(false);
				})
				.try();
		}

	});

	test('the second argument received by the catcher function should be a function', () => {

		const work = () => { throw 3 };

		perform(function* () {
			work();
		})
			.catch(({ error, isRecoverable }, recover) => {
				expect(recover).toBeInstanceOf(Function);
			})
			.try();
	});

	test('when an error is thrown by a yielded computation, the recover function should allow continuation', () => {

		const work = () => { throw 3 };
		const mockFn = jest.fn();

		perform(function* () {
			yield () => work();
			mockFn();
		})
			.catch(({ error, isRecoverable }, recover) => {
				recover();
			})
			.try();

		expect(mockFn).toHaveBeenCalled();
	});

	test('when an error is thrown by a yielded computation, the value passed to the recover function should be inserted inside the generator', () => {

		const work = () => { throw 3 };
		const mockFn = jest.fn();
		const continuationValue = {};

		perform(function* () {
			mockFn(yield () => work());
		})
			.catch(({ error, isRecoverable }, recover) => {
				recover(continuationValue);
			})
			.try();

		expect(mockFn).toHaveBeenCalledWith(continuationValue);
	});

	test('when an error is thrown by the generator, calling the recover function should have no effect', () => {

		const work = () => { throw 3 };
		const mockFn = jest.fn();

		perform(function* () {
			work();
			mockFn();
		})
			.catch(({ error, isRecoverable }, recover) => {
				recover();
			})
			.try();

		expect(mockFn).not.toHaveBeenCalled();
	});

	test('the third argument received by the catcher function should be a function', () => {

		const work = () => { throw 3 };

		perform(function* () {
			work();
		})
			.catch(({ error, isRecoverable }, recover, restart) => {
				expect(restart).toBeInstanceOf(Function);
			})
			.try();
	});

	test('when an error is thrown by a yielded computation, calling restart will restart the generator', () => {

		let alreadyCalled = false;
		const mockFn = jest.fn(() => { throw 3 });

		perform(function* () {
			yield () => mockFn();
		})
			.catch(({ error, isRecoverable }, recover, restart) => {
				if (!alreadyCalled) {
					restart();
					alreadyCalled = true;
				}
			})
			.try();

		expect(mockFn).toHaveBeenCalledTimes(2);
	});

	test('when an error is thrown by the generator, calling restart will restart the generator', () => {

		let alreadyCalled = false;
		const mockFn = jest.fn(() => { throw 3 });

		perform(function* () {
			mockFn();
		})
			.catch(({ error, isRecoverable }, recover, restart) => {
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
	test('the returned object from \'finally\' method call should have a try method', () => {

		const uncompleted = perform(function* () { }).catch(() => { }).finally(() => { });

		expect(uncompleted.try).toBeInstanceOf(Function);
	});

	test('should not start the execution because the try method was not called', () => {

		const mockFn = jest.fn();

		perform(function* () { mockFn(); }).catch(() => { }).finally(() => { });

		expect(mockFn).not.toHaveBeenCalled();
	});

	test('the finalizer function should always be called at the end of the task if no error has occurred', () => {

		const work = () => { };
		const mockedFinalizer = jest.fn();

		perform(function* () {
			work();
		})
			.catch(() => { })
			.finally(mockedFinalizer)
			.try();

		expect(mockedFinalizer).toHaveBeenCalled();
	});

	test('the finalizer function should always be called at the end of the catcher function when the task is not replayed', () => {

		{
			const work = () => { throw 42 };
			const mockedFinalizer = jest.fn();

			perform(function* () {
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

			perform(function* () {
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

	test('should start the execution after the catch method was called', () => {

		const mockFn = jest.fn();

		perform(function* () { mockFn(); }).catch(() => { }).try();

		expect(mockFn).toHaveBeenCalled();
	});

	test('should start the execution after the finally method was called', () => {

		const mockFn = jest.fn();

		perform(function* () { mockFn(); }).catch(() => { }).finally(() => { }).try();

		expect(mockFn).toHaveBeenCalled();
	});

});
