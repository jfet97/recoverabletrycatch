# recoverabletrycatch

This is a little package (compiled into UMD) that brings into play a simple API similar to the `try-catch-finally` syntax to retrieve the main computation after any error was handled.

## install
```sh
$ npm i -S recoverabletrycatch
```

## motivation
Usually after an error is thrown, using `try-catch-finally`, we cannot recover the original code in the point where the error raised up. It's too late because the stack has lost all the relevant data. Ever heard about _stack unwinding_?\
But thanks to ES6 generators we can find a solution to this problem. Don't worry if you are not familiar with that kind of functions, trust me.

## try me
Let's transform a `try-catch` block that wraps a function that could throw an error in the midst of a computation into a generator tailored to suit for the `recoverabletrycatch` API:

0. Arrays start from 0
```js
// START

let res = 0;

try {
	const v1 = firstStep();
	const v2 = secondStep();
	const v3 = thirdStepThatMayThrowAnError();

	res = v1 + v2 - v3;
} catch(e) {
	console.log(e);
}
```

1. Grab what's inside the `try` block and put it inside a generator:
```js
// STEP 1

let res = 0;

function * computation() {
	const v1 = firstStep();
	const v2 = secondStep();
	const v3 = thirdStepThatMayThrowAnError();

	res = v1 + v2 - v3;
}
```

2. Put each computation that may throw inside its own arrow function
```js
// STEP 2

let res = 0;

function * computation() {
	const v1 = firstStep();
	const v2 = secondStep();
	const v3 = () => thirdStepThatMayThrowAnError();

	res = v1 + v2 - v3;
}
```

3. Yield the arrow function
```js
// STEP 3

let res = 0;

function * computation() {
	const v1 = firstStep();
	const v2 = secondStep();
	const v3 = yield () => thirdStepThatMayThrowAnError();

	res = v1 + v2 - v3;
}
```

4. Grab what's inside the `catch` block and put it into a function
```js
// STEP 4

function errorHandler({ error }) { // you will find the error inside the first object argument
	console.log(error);
}
```

5. Use the `recoverabletrycatch` API:
```js
// STEP 5

const { performSync } = require("recoverabletrycatch");

performSync(computation).catch(errorHandler).try();
```

6a. Update the `errorHandler` to recover from the possible error with the value `42`:
```js
// STEP 6a

function errorHandler({ error, isRecoverable }, { recover }) {
	if(isRecoverable) {
		recover(42);
	}
}
```

6b. Update the `errorHandler` to retry the possible failed computation until it succeed:
```js
// STEP 6b

function errorHandler({ error, isRecoverable }, { retry }) {
	if(isRecoverable) {
		retry(Infinity);
	}
}
```

## the API
### error types
First thing you have to know is the difference between __recoverable errors__ and __not-recoverable errors__.\
The former rise from a __yielded computation__ (the one inside a yielded arrow function) and let you do some stuff from the _catcher functon_ (the one you pass to the _catch_ method):
* you can call the `recover` function with a value that will be used instead of the failed computation
* you can call the `retry` function with a numerical value (default is 1) that indicates how many time the problematic computation should be retried before calling again the catcher function
* you can call the `restart` function to try again the whole computation (the generator)

The latter rise from the generator itself, most of the time because you forgot to yield a problematic computation wrapped inside an arrow function. There is no JavaScript magic which can help us; the only thing you can do from the catcher functon is to call the `restart` function that reboots the generator starting a fresh, new instance of it.

Each time the _catcher functon_ will be called, you'll find inside the first object argument the error that interrupted the main execution and a boolean flag that indicates if the error is recoverable or not. So you'll have all the needed informations to to choose how to handle the situation.

Obviously you are not forced to call the `retry` function nor the `recover` function nor the `restart` function: you can let the catcher function end without performing any recover action. If a finalizer function were registered, it will be called. After that the `recoverabletrycatch` will give up control to the main flow.

### performSync
The function `performSync` let you register the generator. It returns an object thanks to which you will register a catcher function.

### catch
The method `catch` let you register a catcher function. It returns an object thanks to which you can register a finalizer function or you can start the generator.\
The catcher function takes two parameters:
1. an object containing the `error` and the `isRecoverable` flag
2. an object containing the `retry` function, the `recover` function and the `restart` function.

```js
// EXAMPLE OF CATCHER FUNCTION
function catcherFuction({error, isRecoverable}, { retry, recover, restart }) {
	// logic
}
```

* if the error is recoverable you will be able to call not only the `retry` function, but the `recover` function and the `restart` function too. Anyway you shouldn't do that. Choose if retry the failed computation XOR recover from the error XOR restart the generator. To let you know the precedence is:
1. restart
2. recover
3. retry
* if the error is not recoverable you will be able to call only the `restart` function. Calling the `recover` function or the `retry` function will have no effects

### finally
The method `finally` let you register a finalizer function. It returns an object thanks to which you can  start the generator.\
The finalizer function will be always called after the main computation ends, no matter how it ends.

### try
The method `try` let you start the main computation.

## simple example that embraces all three error handling strategies
```js
const {
	performSync
} = require("recoverabletrycatch");

function getValue() {
	return 10;
}

function mayThrow() {
	if (Math.random() < 0.5) {
		throw new Error("<0.5 error");
	} else {
		return getValue();
	}
}

function mayThrowSomethingBad() {
	if (Math.random() < 0.5) {
		throw new Error("Really Bad Thing");
	} else {
		return getValue();
	}
}

let res;

performSync(function* () {
		let v1 = getValue();
		let v2 = getValue();

		// yield the problematic computation
		let v3 = yield () => mayThrow();

		let v4 = mayThrowSomethingBad();

		console.log({
			v1,
			v2,
			v3,
			v4
		});

		res = v1 + v2 + v3 + v4;
	})
	.catch(function IIFE() {

		let mayThrowExceptionsAlreadyHandled = false;

		return function ({
			error,
			isRecoverable
		}, {
			retry,
			recover,
			restart
		}) {
			console.log({ error: error.message });
			if (isRecoverable && error.message === "<0.5 error") {
				console.log({ mayThrowExceptionsAlreadyHandled })
				if (!mayThrowExceptionsAlreadyHandled) {
					// try again the failed computation three times
					retry(3);
					mayThrowExceptionsAlreadyHandled = true;
				} else {
					// no way to perform the problematic computation: recover with a custom value
					recover(1);
				}
			}

			if (!isRecoverable && error.message === "Really Bad Thing") {
				// something really bad happened: restart the whole computation
				mayThrowExceptionsAlreadyHandled = false;
				restart();
			}
		}
	}())
	.try();

console.log({
	res
});
```


## async perform
The `recoverabletrycatch` package let you apply the same strategy with asynchronous code as well.\
You will require `performAsync`, instead of `performSync`, passing to it an __asynchronous generator__. Doing so you will be able to yield out async computations, wrapped inside sync or async arrow functions. The yielded computation will be always _awaited_.\
Calling the `try` method will return a _Promise_ that will resolve at the end of the process. If a finalizer function was registered, the Promise will resolve after its execution.

## async example
Let's trasform an async flow where we have to get some information from an endpoint, use those information to post some data to another endpoint and, finally, use the last response to store some data inside a database thanks to a third endpoind.

```js
// START
const axios = require('axios');

;(async () => {
    let data;

    try {
      const todo1 = await axios.get("https://jsonplaceholder.typicode.com/todos/1");
      const post1 = await axios.post("https://jsonplaceholder.typicode.com/posts", { text: todo1 });
      data = (await axios.post("https://reqres.in/api/users", { id: 1, post: post1 })).data;
    } catch {}
		
    console.log({data})
})();
```

Each of those async actions could go wrong, because of server errors for example.
Thanks to `recoverabletrycatch` we will be always able to recover the situation without loosing the already retrieved information; no matter where and when exceptions raised up.

```js
// END
const axios = require('axios');
const {
	performAsync
} = require("recoverabletrycatch");

;(async () => {
    let data;

    await performAsync(
      async function* () {
        const todo1 = yield () => axios.get("https://jsonplaceholder.typicode.com/todos/1");
        const post1 = yield () => axios.post("https://jsonplaceholder.typicode.com/posts", { text: todo1.data });
        data = (yield () => axios.post("https://reqres.in/api/users", { id: 1, post: post1.data })).data;
      }
    )
    .catch(function IIFE() {
      const alreadyRetried = {
        "https://jsonplaceholder.typicode.com/todos/1": false,
        "https://jsonplaceholder.typicode.com/posts": false,
        "https://reqres.in/api/users": false,
      }

      const alreadyRestarted = {
        "https://jsonplaceholder.typicode.com/todos/1": false,
        "https://jsonplaceholder.typicode.com/posts": false,
        "https://reqres.in/api/users": false,
      }
			
      function restore() {
        Object.keys(alreadyRetried).forEach(key => alreadyRetried[key] = false)
      }

      return function catcher({ error }, { retry, restart }) {

        if (!error.response) {
					// this was not an axios error: I chose to do nothing
					console.log({error});
          return;
        }
								
        const url = error.config.url;

        // if we have not alredy tried to reconnect to an url
        // retry five times
        if(!alreadyRetried[url]) {
          retry(5);
          alreadyRetried[url] = true;
					
        // if we have already tried to reconnect to an url
        // restart the whole process but only one time per url
        } else if(!alreadyRestarted[url]){
          restart();
          alreadyRestarted[url] = true;
          // each time we restart the alreadyRetried map must be resetted
          restore();
        }

        // if we have already tried to reconnect to an url
        // and we have already tried to restart the whole process
        // maybe that url wants to be left in peace
				
      }
    }())
    .try();

    console.log({ data });

})();
```

