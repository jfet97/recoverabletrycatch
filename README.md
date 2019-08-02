# recoverabletrycatch

This is a little package that brings into play a simple API similar to the `try-catch-finally` syntax to retrieve the main computation after any error was handled.

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

const { perform } = require("recoverabletrycatch");

perform(computation).catch(errorHandler).try();
```

6. Update the `errorHandler` to recover from the possible error:
```js
// STEP 6

function errorHandler({ error, isRecoverable }, recover) {
	if(isRecoverable) {
		recover(42);
	}
}
```

## the API
### error types
First thing you have to know is the difference between recoverable errors and not-recoverable errors.\
The former rises from a __yielded computation__ (the one inside a yielded arrow function) and let you call the `recover` function from the _catcher functon_ (the one you pass to the _catch_ method) with a value that will be used instead of the failed computation.
The latter rises from the generator itself, most of the time because you forgot to yield a problematic computation wrapped inside an arrow function. There is no JavaScript magic which can help us; the only thing you can do from the catcher functon is to call the `restart` function that reboots the generator starting a fresh, new instance of it.

Each time the _catcher functon_ will be called, you'll find inside the first object argument the error that interrupted the main execution and a boolean flag that indicates if the error is recoverable or not. So you'll have all the needed informations to to choose how to handle the situation.

Obviously you are not forced to call the `recover` function nor the `restart` function: you can let the catcher function end without performing any recover action. If a finalizer function were registered, it will be called. After that the `recoverabletrycatch` will give up control to the main flow.

### perform
The function `perform` let you register the generator. It returns an object thanks to which you will register a catcher function.

### catch
The method `catch` let you register a catcher function. It returns an object thanks to which you can register a finalizer function or you can start the generator.\
The catcher function takes three parameters: an object containing the `error` and the `isRecoverable` flag, the `recover` function and the `restart` function.

```js
// EXAMPLE OF CATHCER FUNCTION
function catcherFuction({error, isRecoverable}, recover, restart) {
	// logic
}
```

* if the error is recoverable you will be able to call both the `recover` and the `restart` functions, but you shouldn't do that. Choose if recover from the error OR if restart the generator. If you will call both, the generator will be restarted
* if the error is not recoverable you will be able to call only the `restart` function. Calling the `recover` function will have no effects

### finally
The method `finally` let you register a finalizer function. It returns an object thanks to which you can  start the generator.\
The finalizer function will be always called after the main computation ends, no matter how it ends.

### try
The method `try` let you start the main computation.

## simple example
```js
function getValue() {
    return Math.floor(Math.random() * 10);
}

function mayThrow() {
    if (Math.random() < 0.5) {
        throw new Error("<0.5 error");
    } else {
        return getValue();
    }
}

let res;

perform(function*() {
        let v1 = getValue();
	let v2 = getValue();
				
	// yield the problematic computation
        let v3 = yield () => mayThrow();
				
	console.log({ v1, v2, v3 });
				
        res = v1 + v2 + v3;
    })
    .catch(function({ error, isRecoverable }, recover) {
        if (isRecoverable && error.message === "<0.5 error") {
	    // if mayThrow has thrown an error, I'll replace its failed computation 
            // with the value 10
            recover(10);
        }
    })
    .try();

console.log({
    res
});
```


## async perform
Work in progress
