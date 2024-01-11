// ATOM - programming language
// It's a tiny, simple language, but powerful enough to express any calculation imaginable. It will allow simple function-based abstractions.
/* Sintyx

do() - body-block
define() - vairable, 1st arg - variable, 2d - value
if(==()) - boolean 1st arg - operator example compare (==), 2d - values
func() - first arg - name func, 2nd - param-s
print() - return/console.log

do(`
    define(name, "Hello ATOM"),
    print(name)
`)
*/

function parseExpression(program) {
    program = skipSpace(program);
    let match, expr;
    if (match = /^"([^"]*)"/.exec(program)) {
        expr = {type: "value", value: match[1]};
    } else if (match = /^\d+\b/.exec(program)) {
        expr = {type: "value", value: Number(match[0])};
    } else if (match = /^[^\s(),#"]+/.exec(program)) {
        expr = {type: "word", name: match[0]};
    } else {
        throw new SyntaxError("Error syntax: " + program);
    }
    
    return parseApply(expr, program.slice(match[0].length));
};

function skipSpace(string) {
    let skippable = string.match(/^(\s|#.*\n)*/);
    return string.slice(skippable[0].length);
};

function parseApply(expr, program) {
    program = skipSpace(program);
    if (program[0] != "(") {
        return {expr: expr, rest: program};
    }

    program = skipSpace(program.slice(1));
    expr = {type: "apply", operator: expr, args: []};
    while (program[0] != ")") {
        let arg = parseExpression(program);
        expr.args.push(arg.expr);
        program = skipSpace(arg.rest);
        if (program[0] == ",") {
            program = skipSpace(program.slice(1));
        } else if (program[0] != ")") {
            throw new SyntaxError("Expected ',' or ')'");
        }
    }
    return parseApply(expr, program.slice(1));
};

function parse(program) {
    let {expr, rest} = parseExpression(program);
    if (skipSpace(rest).length > 0) {
        throw new SyntaxError("Wrong string after program");
    }
    return expr;
};

const specialForms = Object.create(null);

function evaluate(expr, scope) {
    if (expr.type == "value") {
        return expr.value;
    } else if (expr.type == "word") {
        if (expr.name in scope) {
            return scope[expr.name];
        } else {
            throw new ReferenceError(
                `Undefined value: ${expr.name}`
            );
        }
    } else if (expr.type == "apply") {
        let {operator, args} = expr;
        if (operator.type == "word" && operator.name in specialForms) {
            return specialForms[operator.name](expr.args, scope);
        } else {
            let op = evaluate(operator, scope);
            if (typeof op == "function") {
                return op(...args.map(arg => evaluate(arg, scope)));
            } else {
                throw new TypeError("Program is not a function.");
            }
        }
    }
};

specialForms.if = (args, scope) => {
    if (args.length != 3) {
        throw new SyntaxError("Wrong quantity args for if");
    } else if (evaluate(args[0], scope) !== false) {
        return evaluate(args[1], scope);
    } else {
        return evaluate(args[2], scope);
    }
};

specialForms.while = (args, scope) => {
    if (args.length != 2) {
        throw new SyntaxError("Wrong number args for while");
    }
    while (evaluate(args[0], scope) !== false) {
        evaluate(args[1], scope);
    }
    //  Поскольку значения undefined в Atom не существует,
    //  При отсутствии осмысленного результата возвращаем false.
    return false
};

specialForms.do = (args, scope) => {
    let value = false;
    for (let arg of args) {
        value = evaluate(arg, scope);
    }
    return value;
};

specialForms.define = (args, scope) => {
    if(args.length != 2 || args[0].type != "word") {
        throw new SyntaxError("Wrong use value");
    }

    let value = evaluate(args[1], scope);
    scope[args[0].name] = value;
    return value;
};

specialForms.set = (args, scope) => {
    if (args.length != 2 || args[0].type != "word") {
        throw new SyntaxError("Bad use of set");
    }
    let varName = args[0].name;
    let value = evaluate(args[1], scope);

    for (let env = scope; env; env = Object.getPrototypeOf(env)) { // Find the binding in the scope chain.
        if (Object.prototype.hasOwnProperty.call(env, varName)) {
            env[varName] = value;
            return value;
        }
    }
    throw new ReferenceError(`Variable "${varName}" not declared`);
};

const topScope = Object.create(null);

topScope.true = true;
topScope.false = false;

for (let op of ["+", "-", "*", "/", "==", "<", ">"]) {
    topScope[op] = Function("a, b", `return a ${op} b;`);
};

topScope.print = value => {
    console.log(value);
    return value;
};

topScope.array = (...values) => {
    return values;
}

topScope.length = (array) => {
    return array.length
}

topScope.element = (array, n) =>{
    return array[n]
}

function run(program) {
    return evaluate(parse(program), Object.create(topScope));
};

specialForms.func = (args, scope) => {
    if (!args.length) {
        throw new SyntaxError("to function need body");
    }
    let body = args[args.length -1];
    let params = args.slice(0, args.length - 1).map(expr => {
        if (expr.type != "word") {
            throw new SyntaxError("Parameter names must be words");
        }
        return expr.name;
    });
    return function() {
        if (arguments.length != params.length) {
            throw new TypeError("Uncorrect numbers for arguments");
        }
        let localScope = Object.create(scope);
        for (let i = 0; i < arguments.length; i++) {
            localScope[params[i]] = arguments[i];
        }
        return evaluate(body, localScope);
    };
};

// run(`
//     do(define(f, func(a, func(b, +(a,b)))),
//         print(f(4)(5)))
// `)

// run(`
//     do(define(a, 10),
//     #this is commet
//     print(a))
// `)

// run(`
//     do(define(arr, array(1,2,3)),
//         print(arr),
//         print(length(arr)),
//         print(element(arr, 0)))
// `)

// run(`
//     do(define(x, 10),
//        define(setX, func(val, set(x, val))),
//        setX(20),
//        print(x))
// `);

// run(`
//     do(define(plusOne, func(a, +(a, 1))),
//         print(plusOne(10)))
// `);

// run(`
//     do(define(pow, func(base, exp,
//         if(==(exp, 0),
//         1,
//         *(base, pow(base, -(exp, 1)))))),
//         print(pow(2, 10)))
// `);
