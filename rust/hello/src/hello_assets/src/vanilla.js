// Author: David de Kloet (dskloet@gmail.com)

function updateSlot(slot, value) {
  slot.innerHTML = '';
  slot.appendChild(asNode(value));
}

function updateArraySlot(slot, index, count, ...values) {
  for (let i = 0; i < count; i++) {
    slot.childNodes[index].remove();
  }
  let nextNode = slot.childNodes[index];  // null iff appending
  values.forEach((v) => slot.insertBefore(asNode(v), nextNode));
}

function asNode(x) {
  if (x === undefined || x === null || x === '') {
    return document.createComment(x);
  }
  if (x instanceof Node) {
    return x;
  }
  if (typeof(x) === 'string' || typeof(x) === 'number') {
    return document.createTextNode(x);
  }
  if (x.forEach) {
    let node = document.createElement('slot');
    x.forEach(el => node.appendChild(asNode(el)));
    return node;
  }
  if (x instanceof BaseObservable) {
    let node = document.createElement('slot');
    x.listen(updateSlot, node);
    return node;
  }
  if (x instanceof BaseObservableArray) {
    let node = document.createElement('slot');
    x.listen(updateArraySlot, node);
    return node;
  }
  if (x.then) {
    let node = document.createElement('slot');
    x.then((v) => {
      node.innerHTML = '';
      node.appendChild(asNode(v));
    });
    return node;
  }
  throw `Don't know how to turn ${x} into a node.`;
}

// Allows sum(3, 5) to be called as curry(sum)(3)(5).
export function curry(f) {
  function result() {
    if (arguments.length < f.length) {
      return result.bind(null, ...arguments);
    }
    return f(...arguments);
  }
  return result;
}

export let property = curry(function (name, value, element) {
  if (value instanceof BaseObservable) {
    value.listen((el, v) => el[name] = v, element);
  } else {
    element[name] = value;
  }
});

export let attribute = curry(function (name, value, element) {
  if (value instanceof BaseObservable) {
    value.listen((el, v) => attribute(name, v, el), element);
  } else if (value === true) {
    element.setAttribute(name, '');
  } else if (value === false || value === null || value === undefined) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
});

export let className = curry(function (name, value, element) {
  if (value instanceof BaseObservable) {
    value.listen((el, v) => className(name, v, el), element);
  } else if (value) {
    element.classList.add(name);
  } else {
    element.classList.remove(name);
  }
});

function applyClasses(list, element) {
  list.forEach((c) => element.classList.add(c));
}

export function classes() {
  return applyClasses.bind(null, Array.from(arguments));
}

export let event = curry(function (name, listener, element) {
  element.addEventListener(name, listener);
});

export let eventProperty = curry(function (eventName, propName, ob, element) {
  element.addEventListener(
      eventName, (e) => ob.set(element[propName]));
  ob.listen((el, v) => v != el[propName] && (el[propName] = v), element);
});

function applyArg(newElement, arg) {
  if (arg && arg.forEach) {
    arg.forEach(applyArg.bind(null, newElement));
  } else if (arg instanceof Function) {
    arg(newElement);
  } else {
    newElement.append(asNode(arg));
  }
}

export function tag(tag, parseArgs) {
  return function() {
    let newElement = document.createElement(tag);
    let args = Array.from(arguments);
    if (parseArgs) {
      let l = parseArgs.length;
      let argsToParse = args.slice(0, l);
      let remainingArgs = args.slice(l);
      let parsedArgs = parseArgs(...argsToParse);
      args = (parsedArgs.concat ? parsedArgs : [parsedArgs])
          .concat(remainingArgs);
    }
    applyArg(newElement, args);
    return newElement;
  };
}

function spreadProxy(create) {
  return new Proxy({}, {
    get: (obj, prop) => obj[prop] ||= create(prop)
  });
}

export let properties = spreadProxy(property);
export let attributes = spreadProxy(attribute);
export let events = spreadProxy(event);
export let tags = spreadProxy(tag);

export function head() {
  let args = Array.from(arguments);
  applyArg(document.head, args);
}

export function body() {
  let args = Array.from(arguments);
  applyArg(document.body, args);
}

class BaseObservable {
  get value() {
    throw 'Not implemented';
  }

  set(value) {
    throw 'Not implemented';
  }

  listen(listener) {
    throw 'Not implemented';
  }

  map(f) {
    return new MappedObservable(this, f);
  }
}

export class Observable extends BaseObservable {
  #value
  #listeners
  #cleaner

  constructor(v) {
    super();
    this.#value = v;
    this.#listeners = [];
    this.#cleaner = new FinalizationRegistry(unsub => unsub());
  }

  get value() {
    return this.#value;
  }

  set value(v) {
    this.set(v);
  }

  set(value) {
    this.#value = value;
    this.#listeners.forEach((l) => l.callback(value));
  }

  listen(callback, weakArg) {
    if (weakArg) {
      callback = callWithWeakRef.bind(null, callback, new WeakRef(weakArg));
    }
    let listener = {
      callback: callback,
      index: this.#listeners.length
    }
    this.#listeners.push(listener);
    listener.callback(this.#value);
    let unsub = removeListener.bind(null, this.#listeners, listener);
    if (weakArg) {
      this.#cleaner.register(weakArg, unsub);
    }
    return unsub;
  }

  map(f) {
    return new MappedObservable(this, f);
  }
}

class MappedObservable extends BaseObservable {
  #ob;
  #f;

  constructor(ob, f) {
    super();
    this.#ob = ob;
    this.#f = f;
  }

  get value() {
    return this.#ob.value;
  }

  set(value) {
    throw 'Not implemented';
  }

  listen(listener, weakArg) {
    if (weakArg) {
      this.#ob.listen((arg, v) => listener(arg, this.#f(v)), weakArg);
    } else {
      this.#ob.listen(v => listener(this.#f(v)));
    }
  }
}

class BaseObservableArray {
  get length() {
    throw 'Not implemented';
  }

  splice() {
    throw 'Not implemented';
  }

  push(v) {
    this.splice(this.length, 0, v);
    return this.length;
  }

  pop() {
    return this.splice(this.length - 1, 1)[0];
  }

  unshift(v) {
    this.splice(0, 0, v);
    return this.length;
  }

  shift() {
    return this.splice(0, 1)[0];
  }

  remove(v) {
    throw 'Not implemented';
  }

  map(f) {
    return new MappedObservableArray(this, f);
  }

  listen(callback, weakArg) {
    throw 'Not implemented';
  }
}

function callWithWeakRef(f, weakRef, ...args) {
  let arg1 = weakRef && weakRef.deref();
  if (!weakRef || arg1) {
    f(arg1, ...args);
  }
}

function removeListener(array, listener) {
  let last = array.pop();
  let i = listener.index;
  if (i < array.length) {
    last.index = i;
    array[i] = last;
  }
}

export class ObservableArray extends BaseObservableArray {
  #value
  #listeners
  #cleaner

  constructor(v) {
    super();
    this.#value = Array.from(v);
    this.#listeners = [];
    this.#cleaner = new FinalizationRegistry(unsub => unsub());
  }

  get(index) {
    return this.#value[index];
  }

  get value() {
    return this.#value;
  }

  get length() {
    return this.#value.length;
  }

  splice() {
    let ret = this.#value.splice(...arguments);
    this.#listeners.forEach((l) => l.callback(...arguments));
    return ret;
  }

  remove(v) {
    this.splice(this.#value.indexOf(v), 1);
  }

  listen(callback, weakArg) {
    if (weakArg) {
      callback = callWithWeakRef.bind(null, callback, new WeakRef(weakArg));
    }
    let listener = {
      callback: callback,
      index: this.#listeners.length
    }
    this.#listeners.push(listener);
    listener.callback(0, 0, ...this.#value);
    let unsub = removeListener.bind(null, this.#listeners, listener);
    if (weakArg) {
      this.#cleaner.register(weakArg, unsub);
    }
    return unsub;
  }
}

class MappedObservableArray extends BaseObservableArray {
  #src;
  #f;

  constructor(src, f) {
    super();
    this.#src = src;
    this.#f = f;
  }

  get length() {
    return this.#src.length;
  }

  get(index) {
    return this.#f(this.#src.get(index));
  }

  listen(listener, weakArg) {
    if (weakArg) {
      this.#src.listen((arg, index, count, ...values) =>
          listener(arg, index, count, ...(values.map(this.#f))), weakArg);
    } else {
      this.#src.listen((index, count, ...values) =>
          listener(index, count, ...(values.map(this.#f))));
    }
  }
}
