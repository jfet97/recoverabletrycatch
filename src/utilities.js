function* generator() { }

function isFunction(fn) {
    return typeof fn === "function";
}
function isGenerator(fn) {
    return isFunction(fn) && fn instanceof generator.constructor
}

module.exports.isFunction = isFunction;
module.exports.isGenerator = isGenerator;