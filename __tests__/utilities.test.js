const { isFunction, isGenerator } = require("../src/utilities");

test('should pass', () => {
    expect(true).toBe(true);
});

describe("isFunction utility", () => {

    test('should properly detect a function', () => {
        expect(isFunction(() => { })).toBe(true);
    });

    test('should properly detect a non function, the argument is an object', () => {
        expect(isFunction({})).toBe(false);
    });

    test('should properly detect a non function, the argument is an array', () => {
        expect(isFunction([])).toBe(false);
    });

    test('should properly detect a non function, the argument is a Symbol', () => {
        expect(isFunction(Symbol())).toBe(false);
    });

    test('should properly detect a non function, the argument is a number', () => {
        expect(isFunction(42)).toBe(false);
    });

    test('should properly detect a non function, the argument is a string', () => {
        expect(isFunction("")).toBe(false);
    });

    test('should properly detect a non function, the argument is a boolean', () => {
        expect(isFunction(true)).toBe(false);
    });

    test('should properly detect a non function, the argument is null', () => {
        expect(isFunction(null)).toBe(false);
    });

    test('should properly detect a non function, the argument is undefined', () => {
        expect(isFunction(undefined)).toBe(false);
    });

});

describe("isGenerator utility", () => {

    test('should properly detect a non generator, the argument is a function', () => {
        expect(isGenerator(() => { })).toBe(false);
    });

    test('should properly detect a generator', () => {
        expect(isGenerator(function* () { })).toBe(true);
    });

});
