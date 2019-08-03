function isFunction(fn) {
	return typeof fn === "function";
}

function* generator() { }

function isGenerator(fn) {
	return isFunction(fn) && fn instanceof generator.constructor
}

async function* asyncGenerator() { }

function isAsyncGenerator(fn) {
	return isFunction(fn) && fn instanceof asyncGenerator.constructor
}

export { isAsyncGenerator };
export { isGenerator };
export { isFunction };