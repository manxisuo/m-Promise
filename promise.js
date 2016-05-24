var PENDING = 0,
    FULFILLED = 1,
    REJECTED = 2;

function isFunction(fn) {
    return fn instanceof Function;
}

function isObject(obj) {
    return obj instanceof Object;
}

function isPromise(p) {
    return p instanceof Promise;
}

function isThenable(obj) {
    return obj && isFunction(obj.then);
}

function callLater(fn) {
    setTimeout(fn, 0);
}

function Promise(executor) {
    var that = this;
    that.status = PENDING;
    that.value = undefined;
    that.handlerQueue = [];

    executor(function(value) {
        that.transition(FULFILLED, value);
    }, function(reason) {
        that.transition(REJECTED, reason);
    });
}

Promise.prototype.transition = function(status, value) {
    if (this.status === PENDING) {
        this.status = status;
        this.value = value;
        this.process();
    }
};

Promise.prototype.process = function() {
    var that = this;
    if (that.status === PENDING) {
        return;
    }

    while (that.handlerQueue.length > 0) {
        var handler = that.handlerQueue.shift();
        (function(handler) {
            var handlerFn = that.status === FULFILLED ? handler.onFulfilled :
                handler.onRejected;

            if (isFunction(handlerFn)) {
                callLater(function() {
                    try {
                        var x = handlerFn(that.value);
                        resolve(handler.thenPromise, x);
                    } catch (e) {
                        handler.thenPromise.transition(REJECTED,
                            e);
                    }
                });
            } else {
                handler.thenPromise.transition(that.status, that.value);
            }
        })(handler);
    }
};

function resolve(promise, x) {
    if (promise === x) {
        promise.transition(REJECTED, new TypeError());
    } else if (isPromise(x)) {
        x.then(function(value) {
            promise.transition(FULFILLED, value);
        }, function(reason) {
            promise.transition(REJECTED, reason);
        });
    } else if (isObject(x) || isFunction(x)) {
        try {
            var then = x.then;
            if (isFunction(then)) {
                var called = false;
                try {
                    then.call(x, function(y) {
                        if (!called) {
                            resolve(promise, y);
                            called = true;
                        }
                    }, function(r) {
                        if (!called) {
                            promise.transition(REJECTED, r);
                            called = true;
                        }
                    });
                } catch (e) {
                    if (!called) {
                        promise.transition(REJECTED, e);
                    }
                }
            } else {
                promise.transition(FULFILLED, x);
            }
        } catch (e) {
            promise.transition(REJECTED, e);
        }
    } else {
        promise.transition(FULFILLED, x);
    }
};

Promise.resolve = function(value) {
    return new Promise(function(resolve, reject) {
        if (isThenable(value)) {
            value.then(resolve, reject);
        }
        else {
            resolve(value);
        }
    });
};

Promise.reject = function(reason) {
    return new Promise(function(resolve, reject) {
        reject(reason);
    });
};

Promise.prototype.then = function(onFulfilled, onRejected) {
    var thenPromise = new Promise(function() {});

    this.handlerQueue.push({
        onFulfilled: onFulfilled,
        onRejected: onRejected,
        thenPromise: thenPromise
    });

    this.process();

    return thenPromise;
};

if (module && module.exports) {
    module.exports = Promise;
}
