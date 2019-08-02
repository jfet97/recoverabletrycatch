function* generator() { }

function isFunction(fn) {
	return typeof fn === "function";
}
function isGenerator(fn) {
	return isFunction(fn) && fn instanceof generator.constructor
}

export { isFunction, isGenerator };