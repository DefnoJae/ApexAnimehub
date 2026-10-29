"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/is-error/index.js
var require_is_error = __commonJS({
  "node_modules/is-error/index.js"(exports2, module2) {
    "use strict";
    var objectToString = Object.prototype.toString;
    var getPrototypeOf = Object.getPrototypeOf;
    var ERROR_TYPE = "[object Error]";
    module2.exports = function isError3(err) {
      if (typeof err !== "object") {
        return false;
      }
      if (err instanceof Error) {
        return true;
      }
      while (err) {
        if (objectToString.call(err) === ERROR_TYPE) {
          return true;
        }
        err = getPrototypeOf(err);
      }
      return false;
    };
  }
});

// node_modules/pinkie/index.js
var require_pinkie = __commonJS({
  "node_modules/pinkie/index.js"(exports2, module2) {
    "use strict";
    var PENDING = "pending";
    var SETTLED = "settled";
    var FULFILLED = "fulfilled";
    var REJECTED = "rejected";
    var NOOP = function() {
    };
    var isNode = typeof global !== "undefined" && typeof global.process !== "undefined" && typeof global.process.emit === "function";
    var asyncSetTimer = typeof setImmediate === "undefined" ? setTimeout : setImmediate;
    var asyncQueue = [];
    var asyncTimer;
    function asyncFlush() {
      for (var i = 0; i < asyncQueue.length; i++) {
        asyncQueue[i][0](asyncQueue[i][1]);
      }
      asyncQueue = [];
      asyncTimer = false;
    }
    function asyncCall(callback, arg) {
      asyncQueue.push([callback, arg]);
      if (!asyncTimer) {
        asyncTimer = true;
        asyncSetTimer(asyncFlush, 0);
      }
    }
    function invokeResolver(resolver, promise) {
      function resolvePromise(value) {
        resolve(promise, value);
      }
      function rejectPromise(reason) {
        reject(promise, reason);
      }
      try {
        resolver(resolvePromise, rejectPromise);
      } catch (e) {
        rejectPromise(e);
      }
    }
    function invokeCallback(subscriber) {
      var owner = subscriber.owner;
      var settled = owner._state;
      var value = owner._data;
      var callback = subscriber[settled];
      var promise = subscriber.then;
      if (typeof callback === "function") {
        settled = FULFILLED;
        try {
          value = callback(value);
        } catch (e) {
          reject(promise, e);
        }
      }
      if (!handleThenable(promise, value)) {
        if (settled === FULFILLED) {
          resolve(promise, value);
        }
        if (settled === REJECTED) {
          reject(promise, value);
        }
      }
    }
    function handleThenable(promise, value) {
      var resolved;
      try {
        if (promise === value) {
          throw new TypeError("A promises callback cannot return that same promise.");
        }
        if (value && (typeof value === "function" || typeof value === "object")) {
          var then = value.then;
          if (typeof then === "function") {
            then.call(value, function(val) {
              if (!resolved) {
                resolved = true;
                if (value === val) {
                  fulfill(promise, val);
                } else {
                  resolve(promise, val);
                }
              }
            }, function(reason) {
              if (!resolved) {
                resolved = true;
                reject(promise, reason);
              }
            });
            return true;
          }
        }
      } catch (e) {
        if (!resolved) {
          reject(promise, e);
        }
        return true;
      }
      return false;
    }
    function resolve(promise, value) {
      if (promise === value || !handleThenable(promise, value)) {
        fulfill(promise, value);
      }
    }
    function fulfill(promise, value) {
      if (promise._state === PENDING) {
        promise._state = SETTLED;
        promise._data = value;
        asyncCall(publishFulfillment, promise);
      }
    }
    function reject(promise, reason) {
      if (promise._state === PENDING) {
        promise._state = SETTLED;
        promise._data = reason;
        asyncCall(publishRejection, promise);
      }
    }
    function publish(promise) {
      promise._then = promise._then.forEach(invokeCallback);
    }
    function publishFulfillment(promise) {
      promise._state = FULFILLED;
      publish(promise);
    }
    function publishRejection(promise) {
      promise._state = REJECTED;
      publish(promise);
      if (!promise._handled && isNode) {
        global.process.emit("unhandledRejection", promise._data, promise);
      }
    }
    function notifyRejectionHandled(promise) {
      global.process.emit("rejectionHandled", promise);
    }
    function Promise2(resolver) {
      if (typeof resolver !== "function") {
        throw new TypeError("Promise resolver " + resolver + " is not a function");
      }
      if (this instanceof Promise2 === false) {
        throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
      }
      this._then = [];
      invokeResolver(resolver, this);
    }
    Promise2.prototype = {
      constructor: Promise2,
      _state: PENDING,
      _then: null,
      _data: void 0,
      _handled: false,
      then: function(onFulfillment, onRejection) {
        var subscriber = {
          owner: this,
          then: new this.constructor(NOOP),
          fulfilled: onFulfillment,
          rejected: onRejection
        };
        if ((onRejection || onFulfillment) && !this._handled) {
          this._handled = true;
          if (this._state === REJECTED && isNode) {
            asyncCall(notifyRejectionHandled, this);
          }
        }
        if (this._state === FULFILLED || this._state === REJECTED) {
          asyncCall(invokeCallback, subscriber);
        } else {
          this._then.push(subscriber);
        }
        return subscriber.then;
      },
      catch: function(onRejection) {
        return this.then(null, onRejection);
      }
    };
    Promise2.all = function(promises) {
      if (!Array.isArray(promises)) {
        throw new TypeError("You must pass an array to Promise.all().");
      }
      return new Promise2(function(resolve2, reject2) {
        var results = [];
        var remaining = 0;
        function resolver(index) {
          remaining++;
          return function(value) {
            results[index] = value;
            if (!--remaining) {
              resolve2(results);
            }
          };
        }
        for (var i = 0, promise; i < promises.length; i++) {
          promise = promises[i];
          if (promise && typeof promise.then === "function") {
            promise.then(resolver(i), reject2);
          } else {
            results[i] = promise;
          }
        }
        if (!remaining) {
          resolve2(results);
        }
      });
    };
    Promise2.race = function(promises) {
      if (!Array.isArray(promises)) {
        throw new TypeError("You must pass an array to Promise.race().");
      }
      return new Promise2(function(resolve2, reject2) {
        for (var i = 0, promise; i < promises.length; i++) {
          promise = promises[i];
          if (promise && typeof promise.then === "function") {
            promise.then(resolve2, reject2);
          } else {
            resolve2(promise);
          }
        }
      });
    };
    Promise2.resolve = function(value) {
      if (value && typeof value === "object" && value.constructor === Promise2) {
        return value;
      }
      return new Promise2(function(resolve2) {
        resolve2(value);
      });
    };
    Promise2.reject = function(reason) {
      return new Promise2(function(resolve2, reject2) {
        reject2(reason);
      });
    };
    module2.exports = Promise2;
  }
});

// node_modules/pinkie-promise/index.js
var require_pinkie_promise = __commonJS({
  "node_modules/pinkie-promise/index.js"(exports2, module2) {
    "use strict";
    module2.exports = typeof Promise === "function" ? Promise : require_pinkie();
  }
});

// node_modules/mkdirp-classic/index.js
var require_mkdirp_classic = __commonJS({
  "node_modules/mkdirp-classic/index.js"(exports2, module2) {
    var path = require("path");
    var fs6 = require("fs");
    var _0777 = parseInt("0777", 8);
    module2.exports = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;
    function mkdirP(p, opts, f, made) {
      if (typeof opts === "function") {
        f = opts;
        opts = {};
      } else if (!opts || typeof opts !== "object") {
        opts = { mode: opts };
      }
      var mode = opts.mode;
      var xfs = opts.fs || fs6;
      if (mode === void 0) {
        mode = _0777 & ~process.umask();
      }
      if (!made) made = null;
      var cb = f || function() {
      };
      p = path.resolve(p);
      xfs.mkdir(p, mode, function(er) {
        if (!er) {
          made = made || p;
          return cb(null, made);
        }
        switch (er.code) {
          case "ENOENT":
            mkdirP(path.dirname(p), opts, function(er2, made2) {
              if (er2) cb(er2, made2);
              else mkdirP(p, opts, cb, made2);
            });
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            xfs.stat(p, function(er2, stat) {
              if (er2 || !stat.isDirectory()) cb(er, made);
              else cb(null, made);
            });
            break;
        }
      });
    }
    mkdirP.sync = function sync(p, opts, made) {
      if (!opts || typeof opts !== "object") {
        opts = { mode: opts };
      }
      var mode = opts.mode;
      var xfs = opts.fs || fs6;
      if (mode === void 0) {
        mode = _0777 & ~process.umask();
      }
      if (!made) made = null;
      p = path.resolve(p);
      try {
        xfs.mkdirSync(p, mode);
        made = made || p;
      } catch (err0) {
        switch (err0.code) {
          case "ENOENT":
            made = sync(path.dirname(p), opts, made);
            sync(p, opts, made);
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            var stat;
            try {
              stat = xfs.statSync(p);
            } catch (err1) {
              throw err0;
            }
            if (!stat.isDirectory()) throw err0;
            break;
        }
      }
      return made;
    };
  }
});

// node_modules/process-nextick-args/index.js
var require_process_nextick_args = __commonJS({
  "node_modules/process-nextick-args/index.js"(exports2, module2) {
    "use strict";
    if (typeof process === "undefined" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0) {
      module2.exports = { nextTick };
    } else {
      module2.exports = process;
    }
    function nextTick(fn, arg1, arg2, arg3) {
      if (typeof fn !== "function") {
        throw new TypeError('"callback" argument must be a function');
      }
      var len = arguments.length;
      var args, i;
      switch (len) {
        case 0:
        case 1:
          return process.nextTick(fn);
        case 2:
          return process.nextTick(function afterTickOne() {
            fn.call(null, arg1);
          });
        case 3:
          return process.nextTick(function afterTickTwo() {
            fn.call(null, arg1, arg2);
          });
        case 4:
          return process.nextTick(function afterTickThree() {
            fn.call(null, arg1, arg2, arg3);
          });
        default:
          args = new Array(len - 1);
          i = 0;
          while (i < args.length) {
            args[i++] = arguments[i];
          }
          return process.nextTick(function afterTick() {
            fn.apply(null, args);
          });
      }
    }
  }
});

// node_modules/extract-base-iterator/node_modules/isarray/index.js
var require_isarray = __commonJS({
  "node_modules/extract-base-iterator/node_modules/isarray/index.js"(exports2, module2) {
    var toString = {}.toString;
    module2.exports = Array.isArray || function(arr) {
      return toString.call(arr) == "[object Array]";
    };
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/internal/streams/stream.js
var require_stream = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/internal/streams/stream.js"(exports2, module2) {
    module2.exports = require("stream");
  }
});

// node_modules/extract-base-iterator/node_modules/safe-buffer/index.js
var require_safe_buffer = __commonJS({
  "node_modules/extract-base-iterator/node_modules/safe-buffer/index.js"(exports2, module2) {
    var buffer = require("buffer");
    var Buffer3 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer3.from && Buffer3.alloc && Buffer3.allocUnsafe && Buffer3.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      copyProps(buffer, exports2);
      exports2.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer3(arg, encodingOrOffset, length);
    }
    copyProps(Buffer3, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer3(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer3(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer3(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/core-util-is/lib/util.js
var require_util = __commonJS({
  "node_modules/core-util-is/lib/util.js"(exports2) {
    function isArray(arg) {
      if (Array.isArray) {
        return Array.isArray(arg);
      }
      return objectToString(arg) === "[object Array]";
    }
    exports2.isArray = isArray;
    function isBoolean(arg) {
      return typeof arg === "boolean";
    }
    exports2.isBoolean = isBoolean;
    function isNull(arg) {
      return arg === null;
    }
    exports2.isNull = isNull;
    function isNullOrUndefined(arg) {
      return arg == null;
    }
    exports2.isNullOrUndefined = isNullOrUndefined;
    function isNumber(arg) {
      return typeof arg === "number";
    }
    exports2.isNumber = isNumber;
    function isString(arg) {
      return typeof arg === "string";
    }
    exports2.isString = isString;
    function isSymbol(arg) {
      return typeof arg === "symbol";
    }
    exports2.isSymbol = isSymbol;
    function isUndefined(arg) {
      return arg === void 0;
    }
    exports2.isUndefined = isUndefined;
    function isRegExp(re) {
      return objectToString(re) === "[object RegExp]";
    }
    exports2.isRegExp = isRegExp;
    function isObject(arg) {
      return typeof arg === "object" && arg !== null;
    }
    exports2.isObject = isObject;
    function isDate(d) {
      return objectToString(d) === "[object Date]";
    }
    exports2.isDate = isDate;
    function isError3(e) {
      return objectToString(e) === "[object Error]" || e instanceof Error;
    }
    exports2.isError = isError3;
    function isFunction(arg) {
      return typeof arg === "function";
    }
    exports2.isFunction = isFunction;
    function isPrimitive(arg) {
      return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || // ES6 symbol
      typeof arg === "undefined";
    }
    exports2.isPrimitive = isPrimitive;
    exports2.isBuffer = require("buffer").Buffer.isBuffer;
    function objectToString(o) {
      return Object.prototype.toString.call(o);
    }
  }
});

// node_modules/inherits/inherits_browser.js
var require_inherits_browser = __commonJS({
  "node_modules/inherits/inherits_browser.js"(exports2, module2) {
    if (typeof Object.create === "function") {
      module2.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
              value: ctor,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
        }
      };
    } else {
      module2.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          var TempCtor = function() {
          };
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        }
      };
    }
  }
});

// node_modules/inherits/inherits.js
var require_inherits = __commonJS({
  "node_modules/inherits/inherits.js"(exports2, module2) {
    try {
      util = require("util");
      if (typeof util.inherits !== "function") throw "";
      module2.exports = util.inherits;
    } catch (e) {
      module2.exports = require_inherits_browser();
    }
    var util;
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/internal/streams/BufferList.js
var require_BufferList = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/internal/streams/BufferList.js"(exports2, module2) {
    "use strict";
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var Buffer3 = require_safe_buffer().Buffer;
    var util = require("util");
    function copyBuffer(src, target, offset) {
      src.copy(target, offset);
    }
    module2.exports = (function() {
      function BufferList2() {
        _classCallCheck(this, BufferList2);
        this.head = null;
        this.tail = null;
        this.length = 0;
      }
      BufferList2.prototype.push = function push(v) {
        var entry = { data: v, next: null };
        if (this.length > 0) this.tail.next = entry;
        else this.head = entry;
        this.tail = entry;
        ++this.length;
      };
      BufferList2.prototype.unshift = function unshift(v) {
        var entry = { data: v, next: this.head };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      };
      BufferList2.prototype.shift = function shift() {
        if (this.length === 0) return;
        var ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;
        else this.head = this.head.next;
        --this.length;
        return ret;
      };
      BufferList2.prototype.clear = function clear() {
        this.head = this.tail = null;
        this.length = 0;
      };
      BufferList2.prototype.join = function join(s) {
        if (this.length === 0) return "";
        var p = this.head;
        var ret = "" + p.data;
        while (p = p.next) {
          ret += s + p.data;
        }
        return ret;
      };
      BufferList2.prototype.concat = function concat(n) {
        if (this.length === 0) return Buffer3.alloc(0);
        var ret = Buffer3.allocUnsafe(n >>> 0);
        var p = this.head;
        var i = 0;
        while (p) {
          copyBuffer(p.data, ret, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      };
      return BufferList2;
    })();
    if (util && util.inspect && util.inspect.custom) {
      module2.exports.prototype[util.inspect.custom] = function() {
        var obj = util.inspect({ length: this.length });
        return this.constructor.name + " " + obj;
      };
    }
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/internal/streams/destroy.js
var require_destroy = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/internal/streams/destroy.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    function destroy(err, cb) {
      var _this = this;
      var readableDestroyed = this._readableState && this._readableState.destroyed;
      var writableDestroyed = this._writableState && this._writableState.destroyed;
      if (readableDestroyed || writableDestroyed) {
        if (cb) {
          cb(err);
        } else if (err) {
          if (!this._writableState) {
            pna.nextTick(emitErrorNT, this, err);
          } else if (!this._writableState.errorEmitted) {
            this._writableState.errorEmitted = true;
            pna.nextTick(emitErrorNT, this, err);
          }
        }
        return this;
      }
      if (this._readableState) {
        this._readableState.destroyed = true;
      }
      if (this._writableState) {
        this._writableState.destroyed = true;
      }
      this._destroy(err || null, function(err2) {
        if (!cb && err2) {
          if (!_this._writableState) {
            pna.nextTick(emitErrorNT, _this, err2);
          } else if (!_this._writableState.errorEmitted) {
            _this._writableState.errorEmitted = true;
            pna.nextTick(emitErrorNT, _this, err2);
          }
        } else if (cb) {
          cb(err2);
        }
      });
      return this;
    }
    function undestroy() {
      if (this._readableState) {
        this._readableState.destroyed = false;
        this._readableState.reading = false;
        this._readableState.ended = false;
        this._readableState.endEmitted = false;
      }
      if (this._writableState) {
        this._writableState.destroyed = false;
        this._writableState.ended = false;
        this._writableState.ending = false;
        this._writableState.finalCalled = false;
        this._writableState.prefinished = false;
        this._writableState.finished = false;
        this._writableState.errorEmitted = false;
      }
    }
    function emitErrorNT(self2, err) {
      self2.emit("error", err);
    }
    module2.exports = {
      destroy,
      undestroy
    };
  }
});

// node_modules/util-deprecate/node.js
var require_node = __commonJS({
  "node_modules/util-deprecate/node.js"(exports2, module2) {
    module2.exports = require("util").deprecate;
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_writable.js
var require_stream_writable = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_writable.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    module2.exports = Writable2;
    function CorkedRequest(state) {
      var _this = this;
      this.next = null;
      this.entry = null;
      this.finish = function() {
        onCorkedFinish(_this, state);
      };
    }
    var asyncWrite = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
    var Duplex;
    Writable2.WritableState = WritableState;
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var internalUtil = {
      deprecate: require_node()
    };
    var Stream2 = require_stream();
    var Buffer3 = require_safe_buffer().Buffer;
    var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
    };
    function _uint8ArrayToBuffer(chunk) {
      return Buffer3.from(chunk);
    }
    function _isUint8Array(obj) {
      return Buffer3.isBuffer(obj) || obj instanceof OurUint8Array;
    }
    var destroyImpl = require_destroy();
    util.inherits(Writable2, Stream2);
    function nop() {
    }
    function WritableState(options, stream) {
      Duplex = Duplex || require_stream_duplex();
      options = options || {};
      var isDuplex = stream instanceof Duplex;
      this.objectMode = !!options.objectMode;
      if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
      var hwm = options.highWaterMark;
      var writableHwm = options.writableHighWaterMark;
      var defaultHwm = this.objectMode ? 16 : 16 * 1024;
      if (hwm || hwm === 0) this.highWaterMark = hwm;
      else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;
      else this.highWaterMark = defaultHwm;
      this.highWaterMark = Math.floor(this.highWaterMark);
      this.finalCalled = false;
      this.needDrain = false;
      this.ending = false;
      this.ended = false;
      this.finished = false;
      this.destroyed = false;
      var noDecode = options.decodeStrings === false;
      this.decodeStrings = !noDecode;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.length = 0;
      this.writing = false;
      this.corked = 0;
      this.sync = true;
      this.bufferProcessing = false;
      this.onwrite = function(er) {
        onwrite(stream, er);
      };
      this.writecb = null;
      this.writelen = 0;
      this.bufferedRequest = null;
      this.lastBufferedRequest = null;
      this.pendingcb = 0;
      this.prefinished = false;
      this.errorEmitted = false;
      this.bufferedRequestCount = 0;
      this.corkedRequestsFree = new CorkedRequest(this);
    }
    WritableState.prototype.getBuffer = function getBuffer() {
      var current = this.bufferedRequest;
      var out = [];
      while (current) {
        out.push(current);
        current = current.next;
      }
      return out;
    };
    (function() {
      try {
        Object.defineProperty(WritableState.prototype, "buffer", {
          get: internalUtil.deprecate(function() {
            return this.getBuffer();
          }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
        });
      } catch (_) {
      }
    })();
    var realHasInstance;
    if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
      realHasInstance = Function.prototype[Symbol.hasInstance];
      Object.defineProperty(Writable2, Symbol.hasInstance, {
        value: function(object) {
          if (realHasInstance.call(this, object)) return true;
          if (this !== Writable2) return false;
          return object && object._writableState instanceof WritableState;
        }
      });
    } else {
      realHasInstance = function(object) {
        return object instanceof this;
      };
    }
    function Writable2(options) {
      Duplex = Duplex || require_stream_duplex();
      if (!realHasInstance.call(Writable2, this) && !(this instanceof Duplex)) {
        return new Writable2(options);
      }
      this._writableState = new WritableState(options, this);
      this.writable = true;
      if (options) {
        if (typeof options.write === "function") this._write = options.write;
        if (typeof options.writev === "function") this._writev = options.writev;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
        if (typeof options.final === "function") this._final = options.final;
      }
      Stream2.call(this);
    }
    Writable2.prototype.pipe = function() {
      this.emit("error", new Error("Cannot pipe, not readable"));
    };
    function writeAfterEnd(stream, cb) {
      var er = new Error("write after end");
      stream.emit("error", er);
      pna.nextTick(cb, er);
    }
    function validChunk(stream, state, chunk, cb) {
      var valid = true;
      var er = false;
      if (chunk === null) {
        er = new TypeError("May not write null values to stream");
      } else if (typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
        er = new TypeError("Invalid non-string/buffer chunk");
      }
      if (er) {
        stream.emit("error", er);
        pna.nextTick(cb, er);
        valid = false;
      }
      return valid;
    }
    Writable2.prototype.write = function(chunk, encoding, cb) {
      var state = this._writableState;
      var ret = false;
      var isBuf = !state.objectMode && _isUint8Array(chunk);
      if (isBuf && !Buffer3.isBuffer(chunk)) {
        chunk = _uint8ArrayToBuffer(chunk);
      }
      if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
      }
      if (isBuf) encoding = "buffer";
      else if (!encoding) encoding = state.defaultEncoding;
      if (typeof cb !== "function") cb = nop;
      if (state.ended) writeAfterEnd(this, cb);
      else if (isBuf || validChunk(this, state, chunk, cb)) {
        state.pendingcb++;
        ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
      }
      return ret;
    };
    Writable2.prototype.cork = function() {
      var state = this._writableState;
      state.corked++;
    };
    Writable2.prototype.uncork = function() {
      var state = this._writableState;
      if (state.corked) {
        state.corked--;
        if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
      }
    };
    Writable2.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
      if (typeof encoding === "string") encoding = encoding.toLowerCase();
      if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + encoding);
      this._writableState.defaultEncoding = encoding;
      return this;
    };
    function decodeChunk(state, chunk, encoding) {
      if (!state.objectMode && state.decodeStrings !== false && typeof chunk === "string") {
        chunk = Buffer3.from(chunk, encoding);
      }
      return chunk;
    }
    Object.defineProperty(Writable2.prototype, "writableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    });
    function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
      if (!isBuf) {
        var newChunk = decodeChunk(state, chunk, encoding);
        if (chunk !== newChunk) {
          isBuf = true;
          encoding = "buffer";
          chunk = newChunk;
        }
      }
      var len = state.objectMode ? 1 : chunk.length;
      state.length += len;
      var ret = state.length < state.highWaterMark;
      if (!ret) state.needDrain = true;
      if (state.writing || state.corked) {
        var last = state.lastBufferedRequest;
        state.lastBufferedRequest = {
          chunk,
          encoding,
          isBuf,
          callback: cb,
          next: null
        };
        if (last) {
          last.next = state.lastBufferedRequest;
        } else {
          state.bufferedRequest = state.lastBufferedRequest;
        }
        state.bufferedRequestCount += 1;
      } else {
        doWrite(stream, state, false, len, chunk, encoding, cb);
      }
      return ret;
    }
    function doWrite(stream, state, writev, len, chunk, encoding, cb) {
      state.writelen = len;
      state.writecb = cb;
      state.writing = true;
      state.sync = true;
      if (writev) stream._writev(chunk, state.onwrite);
      else stream._write(chunk, encoding, state.onwrite);
      state.sync = false;
    }
    function onwriteError(stream, state, sync, er, cb) {
      --state.pendingcb;
      if (sync) {
        pna.nextTick(cb, er);
        pna.nextTick(finishMaybe, stream, state);
        stream._writableState.errorEmitted = true;
        stream.emit("error", er);
      } else {
        cb(er);
        stream._writableState.errorEmitted = true;
        stream.emit("error", er);
        finishMaybe(stream, state);
      }
    }
    function onwriteStateUpdate(state) {
      state.writing = false;
      state.writecb = null;
      state.length -= state.writelen;
      state.writelen = 0;
    }
    function onwrite(stream, er) {
      var state = stream._writableState;
      var sync = state.sync;
      var cb = state.writecb;
      onwriteStateUpdate(state);
      if (er) onwriteError(stream, state, sync, er, cb);
      else {
        var finished = needFinish(state);
        if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
          clearBuffer(stream, state);
        }
        if (sync) {
          asyncWrite(afterWrite, stream, state, finished, cb);
        } else {
          afterWrite(stream, state, finished, cb);
        }
      }
    }
    function afterWrite(stream, state, finished, cb) {
      if (!finished) onwriteDrain(stream, state);
      state.pendingcb--;
      cb();
      finishMaybe(stream, state);
    }
    function onwriteDrain(stream, state) {
      if (state.length === 0 && state.needDrain) {
        state.needDrain = false;
        stream.emit("drain");
      }
    }
    function clearBuffer(stream, state) {
      state.bufferProcessing = true;
      var entry = state.bufferedRequest;
      if (stream._writev && entry && entry.next) {
        var l = state.bufferedRequestCount;
        var buffer = new Array(l);
        var holder = state.corkedRequestsFree;
        holder.entry = entry;
        var count = 0;
        var allBuffers = true;
        while (entry) {
          buffer[count] = entry;
          if (!entry.isBuf) allBuffers = false;
          entry = entry.next;
          count += 1;
        }
        buffer.allBuffers = allBuffers;
        doWrite(stream, state, true, state.length, buffer, "", holder.finish);
        state.pendingcb++;
        state.lastBufferedRequest = null;
        if (holder.next) {
          state.corkedRequestsFree = holder.next;
          holder.next = null;
        } else {
          state.corkedRequestsFree = new CorkedRequest(state);
        }
        state.bufferedRequestCount = 0;
      } else {
        while (entry) {
          var chunk = entry.chunk;
          var encoding = entry.encoding;
          var cb = entry.callback;
          var len = state.objectMode ? 1 : chunk.length;
          doWrite(stream, state, false, len, chunk, encoding, cb);
          entry = entry.next;
          state.bufferedRequestCount--;
          if (state.writing) {
            break;
          }
        }
        if (entry === null) state.lastBufferedRequest = null;
      }
      state.bufferedRequest = entry;
      state.bufferProcessing = false;
    }
    Writable2.prototype._write = function(chunk, encoding, cb) {
      cb(new Error("_write() is not implemented"));
    };
    Writable2.prototype._writev = null;
    Writable2.prototype.end = function(chunk, encoding, cb) {
      var state = this._writableState;
      if (typeof chunk === "function") {
        cb = chunk;
        chunk = null;
        encoding = null;
      } else if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
      }
      if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
      if (state.corked) {
        state.corked = 1;
        this.uncork();
      }
      if (!state.ending) endWritable(this, state, cb);
    };
    function needFinish(state) {
      return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
    }
    function callFinal(stream, state) {
      stream._final(function(err) {
        state.pendingcb--;
        if (err) {
          stream.emit("error", err);
        }
        state.prefinished = true;
        stream.emit("prefinish");
        finishMaybe(stream, state);
      });
    }
    function prefinish(stream, state) {
      if (!state.prefinished && !state.finalCalled) {
        if (typeof stream._final === "function") {
          state.pendingcb++;
          state.finalCalled = true;
          pna.nextTick(callFinal, stream, state);
        } else {
          state.prefinished = true;
          stream.emit("prefinish");
        }
      }
    }
    function finishMaybe(stream, state) {
      var need = needFinish(state);
      if (need) {
        prefinish(stream, state);
        if (state.pendingcb === 0) {
          state.finished = true;
          stream.emit("finish");
        }
      }
      return need;
    }
    function endWritable(stream, state, cb) {
      state.ending = true;
      finishMaybe(stream, state);
      if (cb) {
        if (state.finished) pna.nextTick(cb);
        else stream.once("finish", cb);
      }
      state.ended = true;
      stream.writable = false;
    }
    function onCorkedFinish(corkReq, state, err) {
      var entry = corkReq.entry;
      corkReq.entry = null;
      while (entry) {
        var cb = entry.callback;
        state.pendingcb--;
        cb(err);
        entry = entry.next;
      }
      state.corkedRequestsFree.next = corkReq;
    }
    Object.defineProperty(Writable2.prototype, "destroyed", {
      get: function() {
        if (this._writableState === void 0) {
          return false;
        }
        return this._writableState.destroyed;
      },
      set: function(value) {
        if (!this._writableState) {
          return;
        }
        this._writableState.destroyed = value;
      }
    });
    Writable2.prototype.destroy = destroyImpl.destroy;
    Writable2.prototype._undestroy = destroyImpl.undestroy;
    Writable2.prototype._destroy = function(err, cb) {
      this.end();
      cb(err);
    };
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_duplex.js
var require_stream_duplex = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_duplex.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    var objectKeys = Object.keys || function(obj) {
      var keys2 = [];
      for (var key in obj) {
        keys2.push(key);
      }
      return keys2;
    };
    module2.exports = Duplex;
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var Readable2 = require_stream_readable();
    var Writable2 = require_stream_writable();
    util.inherits(Duplex, Readable2);
    {
      keys = objectKeys(Writable2.prototype);
      for (v = 0; v < keys.length; v++) {
        method = keys[v];
        if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable2.prototype[method];
      }
    }
    var keys;
    var method;
    var v;
    function Duplex(options) {
      if (!(this instanceof Duplex)) return new Duplex(options);
      Readable2.call(this, options);
      Writable2.call(this, options);
      if (options && options.readable === false) this.readable = false;
      if (options && options.writable === false) this.writable = false;
      this.allowHalfOpen = true;
      if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;
      this.once("end", onend);
    }
    Object.defineProperty(Duplex.prototype, "writableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    });
    function onend() {
      if (this.allowHalfOpen || this._writableState.ended) return;
      pna.nextTick(onEndNT, this);
    }
    function onEndNT(self2) {
      self2.end();
    }
    Object.defineProperty(Duplex.prototype, "destroyed", {
      get: function() {
        if (this._readableState === void 0 || this._writableState === void 0) {
          return false;
        }
        return this._readableState.destroyed && this._writableState.destroyed;
      },
      set: function(value) {
        if (this._readableState === void 0 || this._writableState === void 0) {
          return;
        }
        this._readableState.destroyed = value;
        this._writableState.destroyed = value;
      }
    });
    Duplex.prototype._destroy = function(err, cb) {
      this.push(null);
      this.end();
      pna.nextTick(cb, err);
    };
  }
});

// node_modules/extract-base-iterator/node_modules/string_decoder/lib/string_decoder.js
var require_string_decoder = __commonJS({
  "node_modules/extract-base-iterator/node_modules/string_decoder/lib/string_decoder.js"(exports2) {
    "use strict";
    var Buffer3 = require_safe_buffer().Buffer;
    var isEncoding = Buffer3.isEncoding || function(encoding) {
      encoding = "" + encoding;
      switch (encoding && encoding.toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
        case "raw":
          return true;
        default:
          return false;
      }
    };
    function _normalizeEncoding(enc) {
      if (!enc) return "utf8";
      var retried;
      while (true) {
        switch (enc) {
          case "utf8":
          case "utf-8":
            return "utf8";
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return "utf16le";
          case "latin1":
          case "binary":
            return "latin1";
          case "base64":
          case "ascii":
          case "hex":
            return enc;
          default:
            if (retried) return;
            enc = ("" + enc).toLowerCase();
            retried = true;
        }
      }
    }
    function normalizeEncoding(enc) {
      var nenc = _normalizeEncoding(enc);
      if (typeof nenc !== "string" && (Buffer3.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
      return nenc || enc;
    }
    exports2.StringDecoder = StringDecoder;
    function StringDecoder(encoding) {
      this.encoding = normalizeEncoding(encoding);
      var nb;
      switch (this.encoding) {
        case "utf16le":
          this.text = utf16Text;
          this.end = utf16End;
          nb = 4;
          break;
        case "utf8":
          this.fillLast = utf8FillLast;
          nb = 4;
          break;
        case "base64":
          this.text = base64Text;
          this.end = base64End;
          nb = 3;
          break;
        default:
          this.write = simpleWrite;
          this.end = simpleEnd;
          return;
      }
      this.lastNeed = 0;
      this.lastTotal = 0;
      this.lastChar = Buffer3.allocUnsafe(nb);
    }
    StringDecoder.prototype.write = function(buf) {
      if (buf.length === 0) return "";
      var r;
      var i;
      if (this.lastNeed) {
        r = this.fillLast(buf);
        if (r === void 0) return "";
        i = this.lastNeed;
        this.lastNeed = 0;
      } else {
        i = 0;
      }
      if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
      return r || "";
    };
    StringDecoder.prototype.end = utf8End;
    StringDecoder.prototype.text = utf8Text;
    StringDecoder.prototype.fillLast = function(buf) {
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
      this.lastNeed -= buf.length;
    };
    function utf8CheckByte(byte) {
      if (byte <= 127) return 0;
      else if (byte >> 5 === 6) return 2;
      else if (byte >> 4 === 14) return 3;
      else if (byte >> 3 === 30) return 4;
      return byte >> 6 === 2 ? -1 : -2;
    }
    function utf8CheckIncomplete(self2, buf, i) {
      var j = buf.length - 1;
      if (j < i) return 0;
      var nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self2.lastNeed = nb - 1;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self2.lastNeed = nb - 2;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) {
          if (nb === 2) nb = 0;
          else self2.lastNeed = nb - 3;
        }
        return nb;
      }
      return 0;
    }
    function utf8CheckExtraBytes(self2, buf, p) {
      if ((buf[0] & 192) !== 128) {
        self2.lastNeed = 0;
        return "\uFFFD";
      }
      if (self2.lastNeed > 1 && buf.length > 1) {
        if ((buf[1] & 192) !== 128) {
          self2.lastNeed = 1;
          return "\uFFFD";
        }
        if (self2.lastNeed > 2 && buf.length > 2) {
          if ((buf[2] & 192) !== 128) {
            self2.lastNeed = 2;
            return "\uFFFD";
          }
        }
      }
    }
    function utf8FillLast(buf) {
      var p = this.lastTotal - this.lastNeed;
      var r = utf8CheckExtraBytes(this, buf, p);
      if (r !== void 0) return r;
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, p, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, p, 0, buf.length);
      this.lastNeed -= buf.length;
    }
    function utf8Text(buf, i) {
      var total = utf8CheckIncomplete(this, buf, i);
      if (!this.lastNeed) return buf.toString("utf8", i);
      this.lastTotal = total;
      var end = buf.length - (total - this.lastNeed);
      buf.copy(this.lastChar, 0, end);
      return buf.toString("utf8", i, end);
    }
    function utf8End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + "\uFFFD";
      return r;
    }
    function utf16Text(buf, i) {
      if ((buf.length - i) % 2 === 0) {
        var r = buf.toString("utf16le", i);
        if (r) {
          var c = r.charCodeAt(r.length - 1);
          if (c >= 55296 && c <= 56319) {
            this.lastNeed = 2;
            this.lastTotal = 4;
            this.lastChar[0] = buf[buf.length - 2];
            this.lastChar[1] = buf[buf.length - 1];
            return r.slice(0, -1);
          }
        }
        return r;
      }
      this.lastNeed = 1;
      this.lastTotal = 2;
      this.lastChar[0] = buf[buf.length - 1];
      return buf.toString("utf16le", i, buf.length - 1);
    }
    function utf16End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) {
        var end = this.lastTotal - this.lastNeed;
        return r + this.lastChar.toString("utf16le", 0, end);
      }
      return r;
    }
    function base64Text(buf, i) {
      var n = (buf.length - i) % 3;
      if (n === 0) return buf.toString("base64", i);
      this.lastNeed = 3 - n;
      this.lastTotal = 3;
      if (n === 1) {
        this.lastChar[0] = buf[buf.length - 1];
      } else {
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
      }
      return buf.toString("base64", i, buf.length - n);
    }
    function base64End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
      return r;
    }
    function simpleWrite(buf) {
      return buf.toString(this.encoding);
    }
    function simpleEnd(buf) {
      return buf && buf.length ? this.write(buf) : "";
    }
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_readable.js
var require_stream_readable = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_readable.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    module2.exports = Readable2;
    var isArray = require_isarray();
    var Duplex;
    Readable2.ReadableState = ReadableState;
    var EE = require("events").EventEmitter;
    var EElistenerCount = function(emitter, type) {
      return emitter.listeners(type).length;
    };
    var Stream2 = require_stream();
    var Buffer3 = require_safe_buffer().Buffer;
    var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
    };
    function _uint8ArrayToBuffer(chunk) {
      return Buffer3.from(chunk);
    }
    function _isUint8Array(obj) {
      return Buffer3.isBuffer(obj) || obj instanceof OurUint8Array;
    }
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var debugUtil = require("util");
    var debug = void 0;
    if (debugUtil && debugUtil.debuglog) {
      debug = debugUtil.debuglog("stream");
    } else {
      debug = function() {
      };
    }
    var BufferList2 = require_BufferList();
    var destroyImpl = require_destroy();
    var StringDecoder;
    util.inherits(Readable2, Stream2);
    var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];
    function prependListener(emitter, event, fn) {
      if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
      if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
      else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);
      else emitter._events[event] = [fn, emitter._events[event]];
    }
    function ReadableState(options, stream) {
      Duplex = Duplex || require_stream_duplex();
      options = options || {};
      var isDuplex = stream instanceof Duplex;
      this.objectMode = !!options.objectMode;
      if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
      var hwm = options.highWaterMark;
      var readableHwm = options.readableHighWaterMark;
      var defaultHwm = this.objectMode ? 16 : 16 * 1024;
      if (hwm || hwm === 0) this.highWaterMark = hwm;
      else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;
      else this.highWaterMark = defaultHwm;
      this.highWaterMark = Math.floor(this.highWaterMark);
      this.buffer = new BufferList2();
      this.length = 0;
      this.pipes = null;
      this.pipesCount = 0;
      this.flowing = null;
      this.ended = false;
      this.endEmitted = false;
      this.reading = false;
      this.sync = true;
      this.needReadable = false;
      this.emittedReadable = false;
      this.readableListening = false;
      this.resumeScheduled = false;
      this.destroyed = false;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.awaitDrain = 0;
      this.readingMore = false;
      this.decoder = null;
      this.encoding = null;
      if (options.encoding) {
        if (!StringDecoder) StringDecoder = require_string_decoder().StringDecoder;
        this.decoder = new StringDecoder(options.encoding);
        this.encoding = options.encoding;
      }
    }
    function Readable2(options) {
      Duplex = Duplex || require_stream_duplex();
      if (!(this instanceof Readable2)) return new Readable2(options);
      this._readableState = new ReadableState(options, this);
      this.readable = true;
      if (options) {
        if (typeof options.read === "function") this._read = options.read;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
      }
      Stream2.call(this);
    }
    Object.defineProperty(Readable2.prototype, "destroyed", {
      get: function() {
        if (this._readableState === void 0) {
          return false;
        }
        return this._readableState.destroyed;
      },
      set: function(value) {
        if (!this._readableState) {
          return;
        }
        this._readableState.destroyed = value;
      }
    });
    Readable2.prototype.destroy = destroyImpl.destroy;
    Readable2.prototype._undestroy = destroyImpl.undestroy;
    Readable2.prototype._destroy = function(err, cb) {
      this.push(null);
      cb(err);
    };
    Readable2.prototype.push = function(chunk, encoding) {
      var state = this._readableState;
      var skipChunkCheck;
      if (!state.objectMode) {
        if (typeof chunk === "string") {
          encoding = encoding || state.defaultEncoding;
          if (encoding !== state.encoding) {
            chunk = Buffer3.from(chunk, encoding);
            encoding = "";
          }
          skipChunkCheck = true;
        }
      } else {
        skipChunkCheck = true;
      }
      return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
    };
    Readable2.prototype.unshift = function(chunk) {
      return readableAddChunk(this, chunk, null, true, false);
    };
    function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
      var state = stream._readableState;
      if (chunk === null) {
        state.reading = false;
        onEofChunk(stream, state);
      } else {
        var er;
        if (!skipChunkCheck) er = chunkInvalid(state, chunk);
        if (er) {
          stream.emit("error", er);
        } else if (state.objectMode || chunk && chunk.length > 0) {
          if (typeof chunk !== "string" && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer3.prototype) {
            chunk = _uint8ArrayToBuffer(chunk);
          }
          if (addToFront) {
            if (state.endEmitted) stream.emit("error", new Error("stream.unshift() after end event"));
            else addChunk(stream, state, chunk, true);
          } else if (state.ended) {
            stream.emit("error", new Error("stream.push() after EOF"));
          } else {
            state.reading = false;
            if (state.decoder && !encoding) {
              chunk = state.decoder.write(chunk);
              if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);
              else maybeReadMore(stream, state);
            } else {
              addChunk(stream, state, chunk, false);
            }
          }
        } else if (!addToFront) {
          state.reading = false;
        }
      }
      return needMoreData(state);
    }
    function addChunk(stream, state, chunk, addToFront) {
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit("data", chunk);
        stream.read(0);
      } else {
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront) state.buffer.unshift(chunk);
        else state.buffer.push(chunk);
        if (state.needReadable) emitReadable(stream);
      }
      maybeReadMore(stream, state);
    }
    function chunkInvalid(state, chunk) {
      var er;
      if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
        er = new TypeError("Invalid non-string/buffer chunk");
      }
      return er;
    }
    function needMoreData(state) {
      return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
    }
    Readable2.prototype.isPaused = function() {
      return this._readableState.flowing === false;
    };
    Readable2.prototype.setEncoding = function(enc) {
      if (!StringDecoder) StringDecoder = require_string_decoder().StringDecoder;
      this._readableState.decoder = new StringDecoder(enc);
      this._readableState.encoding = enc;
      return this;
    };
    var MAX_HWM = 8388608;
    function computeNewHighWaterMark(n) {
      if (n >= MAX_HWM) {
        n = MAX_HWM;
      } else {
        n--;
        n |= n >>> 1;
        n |= n >>> 2;
        n |= n >>> 4;
        n |= n >>> 8;
        n |= n >>> 16;
        n++;
      }
      return n;
    }
    function howMuchToRead(n, state) {
      if (n <= 0 || state.length === 0 && state.ended) return 0;
      if (state.objectMode) return 1;
      if (n !== n) {
        if (state.flowing && state.length) return state.buffer.head.data.length;
        else return state.length;
      }
      if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
      if (n <= state.length) return n;
      if (!state.ended) {
        state.needReadable = true;
        return 0;
      }
      return state.length;
    }
    Readable2.prototype.read = function(n) {
      debug("read", n);
      n = parseInt(n, 10);
      var state = this._readableState;
      var nOrig = n;
      if (n !== 0) state.emittedReadable = false;
      if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
        debug("read: emitReadable", state.length, state.ended);
        if (state.length === 0 && state.ended) endReadable(this);
        else emitReadable(this);
        return null;
      }
      n = howMuchToRead(n, state);
      if (n === 0 && state.ended) {
        if (state.length === 0) endReadable(this);
        return null;
      }
      var doRead = state.needReadable;
      debug("need readable", doRead);
      if (state.length === 0 || state.length - n < state.highWaterMark) {
        doRead = true;
        debug("length less than watermark", doRead);
      }
      if (state.ended || state.reading) {
        doRead = false;
        debug("reading or ended", doRead);
      } else if (doRead) {
        debug("do read");
        state.reading = true;
        state.sync = true;
        if (state.length === 0) state.needReadable = true;
        this._read(state.highWaterMark);
        state.sync = false;
        if (!state.reading) n = howMuchToRead(nOrig, state);
      }
      var ret;
      if (n > 0) ret = fromList(n, state);
      else ret = null;
      if (ret === null) {
        state.needReadable = true;
        n = 0;
      } else {
        state.length -= n;
      }
      if (state.length === 0) {
        if (!state.ended) state.needReadable = true;
        if (nOrig !== n && state.ended) endReadable(this);
      }
      if (ret !== null) this.emit("data", ret);
      return ret;
    };
    function onEofChunk(stream, state) {
      if (state.ended) return;
      if (state.decoder) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) {
          state.buffer.push(chunk);
          state.length += state.objectMode ? 1 : chunk.length;
        }
      }
      state.ended = true;
      emitReadable(stream);
    }
    function emitReadable(stream) {
      var state = stream._readableState;
      state.needReadable = false;
      if (!state.emittedReadable) {
        debug("emitReadable", state.flowing);
        state.emittedReadable = true;
        if (state.sync) pna.nextTick(emitReadable_, stream);
        else emitReadable_(stream);
      }
    }
    function emitReadable_(stream) {
      debug("emit readable");
      stream.emit("readable");
      flow(stream);
    }
    function maybeReadMore(stream, state) {
      if (!state.readingMore) {
        state.readingMore = true;
        pna.nextTick(maybeReadMore_, stream, state);
      }
    }
    function maybeReadMore_(stream, state) {
      var len = state.length;
      while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
        debug("maybeReadMore read 0");
        stream.read(0);
        if (len === state.length)
          break;
        else len = state.length;
      }
      state.readingMore = false;
    }
    Readable2.prototype._read = function(n) {
      this.emit("error", new Error("_read() is not implemented"));
    };
    Readable2.prototype.pipe = function(dest, pipeOpts) {
      var src = this;
      var state = this._readableState;
      switch (state.pipesCount) {
        case 0:
          state.pipes = dest;
          break;
        case 1:
          state.pipes = [state.pipes, dest];
          break;
        default:
          state.pipes.push(dest);
          break;
      }
      state.pipesCount += 1;
      debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
      var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
      var endFn = doEnd ? onend : unpipe;
      if (state.endEmitted) pna.nextTick(endFn);
      else src.once("end", endFn);
      dest.on("unpipe", onunpipe);
      function onunpipe(readable, unpipeInfo) {
        debug("onunpipe");
        if (readable === src) {
          if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
            unpipeInfo.hasUnpiped = true;
            cleanup();
          }
        }
      }
      function onend() {
        debug("onend");
        dest.end();
      }
      var ondrain = pipeOnDrain(src);
      dest.on("drain", ondrain);
      var cleanedUp = false;
      function cleanup() {
        debug("cleanup");
        dest.removeListener("close", onclose);
        dest.removeListener("finish", onfinish);
        dest.removeListener("drain", ondrain);
        dest.removeListener("error", onerror);
        dest.removeListener("unpipe", onunpipe);
        src.removeListener("end", onend);
        src.removeListener("end", unpipe);
        src.removeListener("data", ondata);
        cleanedUp = true;
        if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
      }
      var increasedAwaitDrain = false;
      src.on("data", ondata);
      function ondata(chunk) {
        debug("ondata");
        increasedAwaitDrain = false;
        var ret = dest.write(chunk);
        if (false === ret && !increasedAwaitDrain) {
          if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
            debug("false write response, pause", state.awaitDrain);
            state.awaitDrain++;
            increasedAwaitDrain = true;
          }
          src.pause();
        }
      }
      function onerror(er) {
        debug("onerror", er);
        unpipe();
        dest.removeListener("error", onerror);
        if (EElistenerCount(dest, "error") === 0) dest.emit("error", er);
      }
      prependListener(dest, "error", onerror);
      function onclose() {
        dest.removeListener("finish", onfinish);
        unpipe();
      }
      dest.once("close", onclose);
      function onfinish() {
        debug("onfinish");
        dest.removeListener("close", onclose);
        unpipe();
      }
      dest.once("finish", onfinish);
      function unpipe() {
        debug("unpipe");
        src.unpipe(dest);
      }
      dest.emit("pipe", src);
      if (!state.flowing) {
        debug("pipe resume");
        src.resume();
      }
      return dest;
    };
    function pipeOnDrain(src) {
      return function() {
        var state = src._readableState;
        debug("pipeOnDrain", state.awaitDrain);
        if (state.awaitDrain) state.awaitDrain--;
        if (state.awaitDrain === 0 && EElistenerCount(src, "data")) {
          state.flowing = true;
          flow(src);
        }
      };
    }
    Readable2.prototype.unpipe = function(dest) {
      var state = this._readableState;
      var unpipeInfo = { hasUnpiped: false };
      if (state.pipesCount === 0) return this;
      if (state.pipesCount === 1) {
        if (dest && dest !== state.pipes) return this;
        if (!dest) dest = state.pipes;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        if (dest) dest.emit("unpipe", this, unpipeInfo);
        return this;
      }
      if (!dest) {
        var dests = state.pipes;
        var len = state.pipesCount;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        for (var i = 0; i < len; i++) {
          dests[i].emit("unpipe", this, { hasUnpiped: false });
        }
        return this;
      }
      var index = indexOf(state.pipes, dest);
      if (index === -1) return this;
      state.pipes.splice(index, 1);
      state.pipesCount -= 1;
      if (state.pipesCount === 1) state.pipes = state.pipes[0];
      dest.emit("unpipe", this, unpipeInfo);
      return this;
    };
    Readable2.prototype.on = function(ev, fn) {
      var res = Stream2.prototype.on.call(this, ev, fn);
      if (ev === "data") {
        if (this._readableState.flowing !== false) this.resume();
      } else if (ev === "readable") {
        var state = this._readableState;
        if (!state.endEmitted && !state.readableListening) {
          state.readableListening = state.needReadable = true;
          state.emittedReadable = false;
          if (!state.reading) {
            pna.nextTick(nReadingNextTick, this);
          } else if (state.length) {
            emitReadable(this);
          }
        }
      }
      return res;
    };
    Readable2.prototype.addListener = Readable2.prototype.on;
    function nReadingNextTick(self2) {
      debug("readable nexttick read 0");
      self2.read(0);
    }
    Readable2.prototype.resume = function() {
      var state = this._readableState;
      if (!state.flowing) {
        debug("resume");
        state.flowing = true;
        resume(this, state);
      }
      return this;
    };
    function resume(stream, state) {
      if (!state.resumeScheduled) {
        state.resumeScheduled = true;
        pna.nextTick(resume_, stream, state);
      }
    }
    function resume_(stream, state) {
      if (!state.reading) {
        debug("resume read 0");
        stream.read(0);
      }
      state.resumeScheduled = false;
      state.awaitDrain = 0;
      stream.emit("resume");
      flow(stream);
      if (state.flowing && !state.reading) stream.read(0);
    }
    Readable2.prototype.pause = function() {
      debug("call pause flowing=%j", this._readableState.flowing);
      if (false !== this._readableState.flowing) {
        debug("pause");
        this._readableState.flowing = false;
        this.emit("pause");
      }
      return this;
    };
    function flow(stream) {
      var state = stream._readableState;
      debug("flow", state.flowing);
      while (state.flowing && stream.read() !== null) {
      }
    }
    Readable2.prototype.wrap = function(stream) {
      var _this = this;
      var state = this._readableState;
      var paused = false;
      stream.on("end", function() {
        debug("wrapped end");
        if (state.decoder && !state.ended) {
          var chunk = state.decoder.end();
          if (chunk && chunk.length) _this.push(chunk);
        }
        _this.push(null);
      });
      stream.on("data", function(chunk) {
        debug("wrapped data");
        if (state.decoder) chunk = state.decoder.write(chunk);
        if (state.objectMode && (chunk === null || chunk === void 0)) return;
        else if (!state.objectMode && (!chunk || !chunk.length)) return;
        var ret = _this.push(chunk);
        if (!ret) {
          paused = true;
          stream.pause();
        }
      });
      for (var i in stream) {
        if (this[i] === void 0 && typeof stream[i] === "function") {
          this[i] = /* @__PURE__ */ (function(method) {
            return function() {
              return stream[method].apply(stream, arguments);
            };
          })(i);
        }
      }
      for (var n = 0; n < kProxyEvents.length; n++) {
        stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
      }
      this._read = function(n2) {
        debug("wrapped _read", n2);
        if (paused) {
          paused = false;
          stream.resume();
        }
      };
      return this;
    };
    Object.defineProperty(Readable2.prototype, "readableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._readableState.highWaterMark;
      }
    });
    Readable2._fromList = fromList;
    function fromList(n, state) {
      if (state.length === 0) return null;
      var ret;
      if (state.objectMode) ret = state.buffer.shift();
      else if (!n || n >= state.length) {
        if (state.decoder) ret = state.buffer.join("");
        else if (state.buffer.length === 1) ret = state.buffer.head.data;
        else ret = state.buffer.concat(state.length);
        state.buffer.clear();
      } else {
        ret = fromListPartial(n, state.buffer, state.decoder);
      }
      return ret;
    }
    function fromListPartial(n, list, hasStrings) {
      var ret;
      if (n < list.head.data.length) {
        ret = list.head.data.slice(0, n);
        list.head.data = list.head.data.slice(n);
      } else if (n === list.head.data.length) {
        ret = list.shift();
      } else {
        ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
      }
      return ret;
    }
    function copyFromBufferString(n, list) {
      var p = list.head;
      var c = 1;
      var ret = p.data;
      n -= ret.length;
      while (p = p.next) {
        var str = p.data;
        var nb = n > str.length ? str.length : n;
        if (nb === str.length) ret += str;
        else ret += str.slice(0, n);
        n -= nb;
        if (n === 0) {
          if (nb === str.length) {
            ++c;
            if (p.next) list.head = p.next;
            else list.head = list.tail = null;
          } else {
            list.head = p;
            p.data = str.slice(nb);
          }
          break;
        }
        ++c;
      }
      list.length -= c;
      return ret;
    }
    function copyFromBuffer(n, list) {
      var ret = Buffer3.allocUnsafe(n);
      var p = list.head;
      var c = 1;
      p.data.copy(ret);
      n -= p.data.length;
      while (p = p.next) {
        var buf = p.data;
        var nb = n > buf.length ? buf.length : n;
        buf.copy(ret, ret.length - n, 0, nb);
        n -= nb;
        if (n === 0) {
          if (nb === buf.length) {
            ++c;
            if (p.next) list.head = p.next;
            else list.head = list.tail = null;
          } else {
            list.head = p;
            p.data = buf.slice(nb);
          }
          break;
        }
        ++c;
      }
      list.length -= c;
      return ret;
    }
    function endReadable(stream) {
      var state = stream._readableState;
      if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');
      if (!state.endEmitted) {
        state.ended = true;
        pna.nextTick(endReadableNT, state, stream);
      }
    }
    function endReadableNT(state, stream) {
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit("end");
      }
    }
    function indexOf(xs, x) {
      for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) return i;
      }
      return -1;
    }
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_transform.js
var require_stream_transform = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_transform.js"(exports2, module2) {
    "use strict";
    module2.exports = Transform2;
    var Duplex = require_stream_duplex();
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    util.inherits(Transform2, Duplex);
    function afterTransform(er, data) {
      var ts = this._transformState;
      ts.transforming = false;
      var cb = ts.writecb;
      if (!cb) {
        return this.emit("error", new Error("write callback called multiple times"));
      }
      ts.writechunk = null;
      ts.writecb = null;
      if (data != null)
        this.push(data);
      cb(er);
      var rs = this._readableState;
      rs.reading = false;
      if (rs.needReadable || rs.length < rs.highWaterMark) {
        this._read(rs.highWaterMark);
      }
    }
    function Transform2(options) {
      if (!(this instanceof Transform2)) return new Transform2(options);
      Duplex.call(this, options);
      this._transformState = {
        afterTransform: afterTransform.bind(this),
        needTransform: false,
        transforming: false,
        writecb: null,
        writechunk: null,
        writeencoding: null
      };
      this._readableState.needReadable = true;
      this._readableState.sync = false;
      if (options) {
        if (typeof options.transform === "function") this._transform = options.transform;
        if (typeof options.flush === "function") this._flush = options.flush;
      }
      this.on("prefinish", prefinish);
    }
    function prefinish() {
      var _this = this;
      if (typeof this._flush === "function") {
        this._flush(function(er, data) {
          done(_this, er, data);
        });
      } else {
        done(this, null, null);
      }
    }
    Transform2.prototype.push = function(chunk, encoding) {
      this._transformState.needTransform = false;
      return Duplex.prototype.push.call(this, chunk, encoding);
    };
    Transform2.prototype._transform = function(chunk, encoding, cb) {
      throw new Error("_transform() is not implemented");
    };
    Transform2.prototype._write = function(chunk, encoding, cb) {
      var ts = this._transformState;
      ts.writecb = cb;
      ts.writechunk = chunk;
      ts.writeencoding = encoding;
      if (!ts.transforming) {
        var rs = this._readableState;
        if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
      }
    };
    Transform2.prototype._read = function(n) {
      var ts = this._transformState;
      if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
        ts.transforming = true;
        this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
      } else {
        ts.needTransform = true;
      }
    };
    Transform2.prototype._destroy = function(err, cb) {
      var _this2 = this;
      Duplex.prototype._destroy.call(this, err, function(err2) {
        cb(err2);
        _this2.emit("close");
      });
    };
    function done(stream, er, data) {
      if (er) return stream.emit("error", er);
      if (data != null)
        stream.push(data);
      if (stream._writableState.length) throw new Error("Calling transform done when ws.length != 0");
      if (stream._transformState.transforming) throw new Error("Calling transform done when still transforming");
      return stream.push(null);
    }
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_passthrough.js
var require_stream_passthrough = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/lib/_stream_passthrough.js"(exports2, module2) {
    "use strict";
    module2.exports = PassThrough2;
    var Transform2 = require_stream_transform();
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    util.inherits(PassThrough2, Transform2);
    function PassThrough2(options) {
      if (!(this instanceof PassThrough2)) return new PassThrough2(options);
      Transform2.call(this, options);
    }
    PassThrough2.prototype._transform = function(chunk, encoding, cb) {
      cb(null, chunk);
    };
  }
});

// node_modules/extract-base-iterator/node_modules/readable-stream/readable.js
var require_readable = __commonJS({
  "node_modules/extract-base-iterator/node_modules/readable-stream/readable.js"(exports2, module2) {
    var Stream2 = require("stream");
    if (process.env.READABLE_STREAM === "disable" && Stream2) {
      module2.exports = Stream2;
      exports2 = module2.exports = Stream2.Readable;
      exports2.Readable = Stream2.Readable;
      exports2.Writable = Stream2.Writable;
      exports2.Duplex = Stream2.Duplex;
      exports2.Transform = Stream2.Transform;
      exports2.PassThrough = Stream2.PassThrough;
      exports2.Stream = Stream2;
    } else {
      exports2 = module2.exports = require_stream_readable();
      exports2.Stream = Stream2 || exports2;
      exports2.Readable = exports2;
      exports2.Writable = require_stream_writable();
      exports2.Duplex = require_stream_duplex();
      exports2.Transform = require_stream_transform();
      exports2.PassThrough = require_stream_passthrough();
    }
  }
});

// node_modules/graceful-fs/polyfills.js
var require_polyfills = __commonJS({
  "node_modules/graceful-fs/polyfills.js"(exports2, module2) {
    var constants = require("constants");
    var origCwd = process.cwd;
    var cwd = null;
    var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
    process.cwd = function() {
      if (!cwd)
        cwd = origCwd.call(process);
      return cwd;
    };
    try {
      process.cwd();
    } catch (er) {
    }
    if (typeof process.chdir === "function") {
      chdir = process.chdir;
      process.chdir = function(d) {
        cwd = null;
        chdir.call(process, d);
      };
      if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
    }
    var chdir;
    module2.exports = patch;
    function patch(fs6) {
      if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
        patchLchmod(fs6);
      }
      if (!fs6.lutimes) {
        patchLutimes(fs6);
      }
      fs6.chown = chownFix(fs6.chown);
      fs6.fchown = chownFix(fs6.fchown);
      fs6.lchown = chownFix(fs6.lchown);
      fs6.chmod = chmodFix(fs6.chmod);
      fs6.fchmod = chmodFix(fs6.fchmod);
      fs6.lchmod = chmodFix(fs6.lchmod);
      fs6.chownSync = chownFixSync(fs6.chownSync);
      fs6.fchownSync = chownFixSync(fs6.fchownSync);
      fs6.lchownSync = chownFixSync(fs6.lchownSync);
      fs6.chmodSync = chmodFixSync(fs6.chmodSync);
      fs6.fchmodSync = chmodFixSync(fs6.fchmodSync);
      fs6.lchmodSync = chmodFixSync(fs6.lchmodSync);
      fs6.stat = statFix(fs6.stat);
      fs6.fstat = statFix(fs6.fstat);
      fs6.lstat = statFix(fs6.lstat);
      fs6.statSync = statFixSync(fs6.statSync);
      fs6.fstatSync = statFixSync(fs6.fstatSync);
      fs6.lstatSync = statFixSync(fs6.lstatSync);
      if (fs6.chmod && !fs6.lchmod) {
        fs6.lchmod = function(path, mode, cb) {
          if (cb) process.nextTick(cb);
        };
        fs6.lchmodSync = function() {
        };
      }
      if (fs6.chown && !fs6.lchown) {
        fs6.lchown = function(path, uid, gid, cb) {
          if (cb) process.nextTick(cb);
        };
        fs6.lchownSync = function() {
        };
      }
      if (platform === "win32") {
        fs6.rename = typeof fs6.rename !== "function" ? fs6.rename : (function(fs$rename) {
          function rename(from, to, cb) {
            var start = Date.now();
            var backoff = 0;
            fs$rename(from, to, function CB(er) {
              if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
                setTimeout(function() {
                  fs6.stat(to, function(stater, st) {
                    if (stater && stater.code === "ENOENT")
                      fs$rename(from, to, CB);
                    else
                      cb(er);
                  });
                }, backoff);
                if (backoff < 100)
                  backoff += 10;
                return;
              }
              if (cb) cb(er);
            });
          }
          if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
          return rename;
        })(fs6.rename);
      }
      fs6.read = typeof fs6.read !== "function" ? fs6.read : (function(fs$read) {
        function read(fd, buffer, offset, length, position, callback_) {
          var callback;
          if (callback_ && typeof callback_ === "function") {
            var eagCounter = 0;
            callback = function(er, _, __) {
              if (er && er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                return fs$read.call(fs6, fd, buffer, offset, length, position, callback);
              }
              callback_.apply(this, arguments);
            };
          }
          return fs$read.call(fs6, fd, buffer, offset, length, position, callback);
        }
        if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
        return read;
      })(fs6.read);
      fs6.readSync = typeof fs6.readSync !== "function" ? fs6.readSync : /* @__PURE__ */ (function(fs$readSync) {
        return function(fd, buffer, offset, length, position) {
          var eagCounter = 0;
          while (true) {
            try {
              return fs$readSync.call(fs6, fd, buffer, offset, length, position);
            } catch (er) {
              if (er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                continue;
              }
              throw er;
            }
          }
        };
      })(fs6.readSync);
      function patchLchmod(fs7) {
        fs7.lchmod = function(path, mode, callback) {
          fs7.open(
            path,
            constants.O_WRONLY | constants.O_SYMLINK,
            mode,
            function(err, fd) {
              if (err) {
                if (callback) callback(err);
                return;
              }
              fs7.fchmod(fd, mode, function(err2) {
                fs7.close(fd, function(err22) {
                  if (callback) callback(err2 || err22);
                });
              });
            }
          );
        };
        fs7.lchmodSync = function(path, mode) {
          var fd = fs7.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode);
          var threw = true;
          var ret;
          try {
            ret = fs7.fchmodSync(fd, mode);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs7.closeSync(fd);
              } catch (er) {
              }
            } else {
              fs7.closeSync(fd);
            }
          }
          return ret;
        };
      }
      function patchLutimes(fs7) {
        if (constants.hasOwnProperty("O_SYMLINK") && fs7.futimes) {
          fs7.lutimes = function(path, at, mt, cb) {
            fs7.open(path, constants.O_SYMLINK, function(er, fd) {
              if (er) {
                if (cb) cb(er);
                return;
              }
              fs7.futimes(fd, at, mt, function(er2) {
                fs7.close(fd, function(er22) {
                  if (cb) cb(er2 || er22);
                });
              });
            });
          };
          fs7.lutimesSync = function(path, at, mt) {
            var fd = fs7.openSync(path, constants.O_SYMLINK);
            var ret;
            var threw = true;
            try {
              ret = fs7.futimesSync(fd, at, mt);
              threw = false;
            } finally {
              if (threw) {
                try {
                  fs7.closeSync(fd);
                } catch (er) {
                }
              } else {
                fs7.closeSync(fd);
              }
            }
            return ret;
          };
        } else if (fs7.futimes) {
          fs7.lutimes = function(_a, _b, _c, cb) {
            if (cb) process.nextTick(cb);
          };
          fs7.lutimesSync = function() {
          };
        }
      }
      function chmodFix(orig) {
        if (!orig) return orig;
        return function(target, mode, cb) {
          return orig.call(fs6, target, mode, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chmodFixSync(orig) {
        if (!orig) return orig;
        return function(target, mode) {
          try {
            return orig.call(fs6, target, mode);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function chownFix(orig) {
        if (!orig) return orig;
        return function(target, uid, gid, cb) {
          return orig.call(fs6, target, uid, gid, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chownFixSync(orig) {
        if (!orig) return orig;
        return function(target, uid, gid) {
          try {
            return orig.call(fs6, target, uid, gid);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function statFix(orig) {
        if (!orig) return orig;
        return function(target, options, cb) {
          if (typeof options === "function") {
            cb = options;
            options = null;
          }
          function callback(er, stats) {
            if (stats) {
              if (stats.uid < 0) stats.uid += 4294967296;
              if (stats.gid < 0) stats.gid += 4294967296;
            }
            if (cb) cb.apply(this, arguments);
          }
          return options ? orig.call(fs6, target, options, callback) : orig.call(fs6, target, callback);
        };
      }
      function statFixSync(orig) {
        if (!orig) return orig;
        return function(target, options) {
          var stats = options ? orig.call(fs6, target, options) : orig.call(fs6, target);
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          return stats;
        };
      }
      function chownErOk(er) {
        if (!er)
          return true;
        if (er.code === "ENOSYS")
          return true;
        var nonroot = !process.getuid || process.getuid() !== 0;
        if (nonroot) {
          if (er.code === "EINVAL" || er.code === "EPERM")
            return true;
        }
        return false;
      }
    }
  }
});

// node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = __commonJS({
  "node_modules/graceful-fs/legacy-streams.js"(exports2, module2) {
    var Stream2 = require("stream").Stream;
    module2.exports = legacy;
    function legacy(fs6) {
      return {
        ReadStream,
        WriteStream
      };
      function ReadStream(path, options) {
        if (!(this instanceof ReadStream)) return new ReadStream(path, options);
        Stream2.call(this);
        var self2 = this;
        this.path = path;
        this.fd = null;
        this.readable = true;
        this.paused = false;
        this.flags = "r";
        this.mode = 438;
        this.bufferSize = 64 * 1024;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.encoding) this.setEncoding(this.encoding);
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.end === void 0) {
            this.end = Infinity;
          } else if ("number" !== typeof this.end) {
            throw TypeError("end must be a Number");
          }
          if (this.start > this.end) {
            throw new Error("start must be <= end");
          }
          this.pos = this.start;
        }
        if (this.fd !== null) {
          process.nextTick(function() {
            self2._read();
          });
          return;
        }
        fs6.open(this.path, this.flags, this.mode, function(err, fd) {
          if (err) {
            self2.emit("error", err);
            self2.readable = false;
            return;
          }
          self2.fd = fd;
          self2.emit("open", fd);
          self2._read();
        });
      }
      function WriteStream(path, options) {
        if (!(this instanceof WriteStream)) return new WriteStream(path, options);
        Stream2.call(this);
        this.path = path;
        this.fd = null;
        this.writable = true;
        this.flags = "w";
        this.encoding = "binary";
        this.mode = 438;
        this.bytesWritten = 0;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.start < 0) {
            throw new Error("start must be >= zero");
          }
          this.pos = this.start;
        }
        this.busy = false;
        this._queue = [];
        if (this.fd === null) {
          this._open = fs6.open;
          this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
          this.flush();
        }
      }
    }
  }
});

// node_modules/graceful-fs/clone.js
var require_clone = __commonJS({
  "node_modules/graceful-fs/clone.js"(exports2, module2) {
    "use strict";
    module2.exports = clone;
    var getPrototypeOf = Object.getPrototypeOf || function(obj) {
      return obj.__proto__;
    };
    function clone(obj) {
      if (obj === null || typeof obj !== "object")
        return obj;
      if (obj instanceof Object)
        var copy = { __proto__: getPrototypeOf(obj) };
      else
        var copy = /* @__PURE__ */ Object.create(null);
      Object.getOwnPropertyNames(obj).forEach(function(key) {
        Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
      });
      return copy;
    }
  }
});

// node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = __commonJS({
  "node_modules/graceful-fs/graceful-fs.js"(exports2, module2) {
    var fs6 = require("fs");
    var polyfills = require_polyfills();
    var legacy = require_legacy_streams();
    var clone = require_clone();
    var util = require("util");
    var gracefulQueue;
    var previousSymbol;
    if (typeof Symbol === "function" && typeof Symbol.for === "function") {
      gracefulQueue = Symbol.for("graceful-fs.queue");
      previousSymbol = Symbol.for("graceful-fs.previous");
    } else {
      gracefulQueue = "___graceful-fs.queue";
      previousSymbol = "___graceful-fs.previous";
    }
    function noop() {
    }
    function publishQueue(context, queue2) {
      Object.defineProperty(context, gracefulQueue, {
        get: function() {
          return queue2;
        }
      });
    }
    var debug = noop;
    if (util.debuglog)
      debug = util.debuglog("gfs4");
    else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
      debug = function() {
        var m = util.format.apply(util, arguments);
        m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
        console.error(m);
      };
    if (!fs6[gracefulQueue]) {
      queue = global[gracefulQueue] || [];
      publishQueue(fs6, queue);
      fs6.close = (function(fs$close) {
        function close(fd, cb) {
          return fs$close.call(fs6, fd, function(err) {
            if (!err) {
              resetQueue();
            }
            if (typeof cb === "function")
              cb.apply(this, arguments);
          });
        }
        Object.defineProperty(close, previousSymbol, {
          value: fs$close
        });
        return close;
      })(fs6.close);
      fs6.closeSync = (function(fs$closeSync) {
        function closeSync(fd) {
          fs$closeSync.apply(fs6, arguments);
          resetQueue();
        }
        Object.defineProperty(closeSync, previousSymbol, {
          value: fs$closeSync
        });
        return closeSync;
      })(fs6.closeSync);
      if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
        process.on("exit", function() {
          debug(fs6[gracefulQueue]);
          require("assert").equal(fs6[gracefulQueue].length, 0);
        });
      }
    }
    var queue;
    if (!global[gracefulQueue]) {
      publishQueue(global, fs6[gracefulQueue]);
    }
    module2.exports = patch(clone(fs6));
    if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs6.__patched) {
      module2.exports = patch(fs6);
      fs6.__patched = true;
    }
    function patch(fs7) {
      polyfills(fs7);
      fs7.gracefulify = patch;
      fs7.createReadStream = createReadStream;
      fs7.createWriteStream = createWriteStream;
      var fs$readFile = fs7.readFile;
      fs7.readFile = readFile;
      function readFile(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$readFile(path, options, cb);
        function go$readFile(path2, options2, cb2, startTime) {
          return fs$readFile(path2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$readFile, [path2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$writeFile = fs7.writeFile;
      fs7.writeFile = writeFile;
      function writeFile(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$writeFile(path, data, options, cb);
        function go$writeFile(path2, data2, options2, cb2, startTime) {
          return fs$writeFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$writeFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$appendFile = fs7.appendFile;
      if (fs$appendFile)
        fs7.appendFile = appendFile;
      function appendFile(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$appendFile(path, data, options, cb);
        function go$appendFile(path2, data2, options2, cb2, startTime) {
          return fs$appendFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$appendFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$copyFile = fs7.copyFile;
      if (fs$copyFile)
        fs7.copyFile = copyFile;
      function copyFile(src, dest, flags, cb) {
        if (typeof flags === "function") {
          cb = flags;
          flags = 0;
        }
        return go$copyFile(src, dest, flags, cb);
        function go$copyFile(src2, dest2, flags2, cb2, startTime) {
          return fs$copyFile(src2, dest2, flags2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$readdir = fs7.readdir;
      fs7.readdir = readdir;
      var noReaddirOptionVersions = /^v[0-5]\./;
      function readdir(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        } : function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, options2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        };
        return go$readdir(path, options, cb);
        function fs$readdirCallback(path2, options2, cb2, startTime) {
          return function(err, files) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([
                go$readdir,
                [path2, options2, cb2],
                err,
                startTime || Date.now(),
                Date.now()
              ]);
            else {
              if (files && files.sort)
                files.sort();
              if (typeof cb2 === "function")
                cb2.call(this, err, files);
            }
          };
        }
      }
      if (process.version.substr(0, 4) === "v0.8") {
        var legStreams = legacy(fs7);
        ReadStream = legStreams.ReadStream;
        WriteStream = legStreams.WriteStream;
      }
      var fs$ReadStream = fs7.ReadStream;
      if (fs$ReadStream) {
        ReadStream.prototype = Object.create(fs$ReadStream.prototype);
        ReadStream.prototype.open = ReadStream$open;
      }
      var fs$WriteStream = fs7.WriteStream;
      if (fs$WriteStream) {
        WriteStream.prototype = Object.create(fs$WriteStream.prototype);
        WriteStream.prototype.open = WriteStream$open;
      }
      Object.defineProperty(fs7, "ReadStream", {
        get: function() {
          return ReadStream;
        },
        set: function(val) {
          ReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(fs7, "WriteStream", {
        get: function() {
          return WriteStream;
        },
        set: function(val) {
          WriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileReadStream = ReadStream;
      Object.defineProperty(fs7, "FileReadStream", {
        get: function() {
          return FileReadStream;
        },
        set: function(val) {
          FileReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileWriteStream = WriteStream;
      Object.defineProperty(fs7, "FileWriteStream", {
        get: function() {
          return FileWriteStream;
        },
        set: function(val) {
          FileWriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      function ReadStream(path, options) {
        if (this instanceof ReadStream)
          return fs$ReadStream.apply(this, arguments), this;
        else
          return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
      }
      function ReadStream$open() {
        var that = this;
        open(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            if (that.autoClose)
              that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
            that.read();
          }
        });
      }
      function WriteStream(path, options) {
        if (this instanceof WriteStream)
          return fs$WriteStream.apply(this, arguments), this;
        else
          return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
      }
      function WriteStream$open() {
        var that = this;
        open(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
          }
        });
      }
      function createReadStream(path, options) {
        return new fs7.ReadStream(path, options);
      }
      function createWriteStream(path, options) {
        return new fs7.WriteStream(path, options);
      }
      var fs$open = fs7.open;
      fs7.open = open;
      function open(path, flags, mode, cb) {
        if (typeof mode === "function")
          cb = mode, mode = null;
        return go$open(path, flags, mode, cb);
        function go$open(path2, flags2, mode2, cb2, startTime) {
          return fs$open(path2, flags2, mode2, function(err, fd) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$open, [path2, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      return fs7;
    }
    function enqueue(elem) {
      debug("ENQUEUE", elem[0].name, elem[1]);
      fs6[gracefulQueue].push(elem);
      retry();
    }
    var retryTimer;
    function resetQueue() {
      var now = Date.now();
      for (var i = 0; i < fs6[gracefulQueue].length; ++i) {
        if (fs6[gracefulQueue][i].length > 2) {
          fs6[gracefulQueue][i][3] = now;
          fs6[gracefulQueue][i][4] = now;
        }
      }
      retry();
    }
    function retry() {
      clearTimeout(retryTimer);
      retryTimer = void 0;
      if (fs6[gracefulQueue].length === 0)
        return;
      var elem = fs6[gracefulQueue].shift();
      var fn = elem[0];
      var args = elem[1];
      var err = elem[2];
      var startTime = elem[3];
      var lastTime = elem[4];
      if (startTime === void 0) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args);
      } else if (Date.now() - startTime >= 6e4) {
        debug("TIMEOUT", fn.name, args);
        var cb = args.pop();
        if (typeof cb === "function")
          cb.call(null, err);
      } else {
        var sinceAttempt = Date.now() - lastTime;
        var sinceStart = Math.max(lastTime - startTime, 1);
        var desiredDelay = Math.min(sinceStart * 1.2, 100);
        if (sinceAttempt >= desiredDelay) {
          debug("RETRY", fn.name, args);
          fn.apply(null, args.concat([startTime]));
        } else {
          fs6[gracefulQueue].push(elem);
        }
      }
      if (retryTimer === void 0) {
        retryTimer = setTimeout(retry, 0);
      }
    }
  }
});

// node_modules/unc-path-regex/index.js
var require_unc_path_regex = __commonJS({
  "node_modules/unc-path-regex/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function uncPathRegex() {
      return /^[\\\/]{2,}[^\\\/]+[\\\/]+[^\\\/]+/;
    };
  }
});

// node_modules/is-unc-path/index.js
var require_is_unc_path = __commonJS({
  "node_modules/is-unc-path/index.js"(exports2, module2) {
    "use strict";
    var regex = require_unc_path_regex()();
    module2.exports = function(filepath) {
      if (typeof filepath !== "string") {
        throw new TypeError("expected a string");
      }
      return regex.test(filepath);
    };
  }
});

// node_modules/is-relative/index.js
var require_is_relative = __commonJS({
  "node_modules/is-relative/index.js"(exports2, module2) {
    "use strict";
    var isUncPath = require_is_unc_path();
    module2.exports = function isRelative(filepath) {
      if (typeof filepath !== "string") {
        throw new TypeError("expected filepath to be a string");
      }
      return !isUncPath(filepath) && !/^([a-z]:)?[\\\/]/i.test(filepath);
    };
  }
});

// node_modules/is-windows/index.js
var require_is_windows = __commonJS({
  "node_modules/is-windows/index.js"(exports2, module2) {
    (function(factory) {
      if (exports2 && typeof exports2 === "object" && typeof module2 !== "undefined") {
        module2.exports = factory();
      } else if (typeof define === "function" && define.amd) {
        define([], factory);
      } else if (typeof window !== "undefined") {
        window.isWindows = factory();
      } else if (typeof global !== "undefined") {
        global.isWindows = factory();
      } else if (typeof self !== "undefined") {
        self.isWindows = factory();
      } else {
        this.isWindows = factory();
      }
    })(function() {
      "use strict";
      return function isWindows3() {
        return process && (process.platform === "win32" || /^(msys|cygwin)$/.test(process.env.OSTYPE));
      };
    });
  }
});

// node_modules/is-absolute/index.js
var require_is_absolute = __commonJS({
  "node_modules/is-absolute/index.js"(exports2, module2) {
    "use strict";
    var isRelative = require_is_relative();
    var isWindows3 = require_is_windows();
    module2.exports = isAbsolute3;
    function isAbsolute3(fp) {
      if (typeof fp !== "string") {
        throw new TypeError("isAbsolute expects a string.");
      }
      return isWindows3() ? isAbsolute3.win32(fp) : isAbsolute3.posix(fp);
    }
    isAbsolute3.posix = function posixPath(fp) {
      return fp.charAt(0) === "/";
    };
    isAbsolute3.win32 = function win32(fp) {
      if (/[a-z]/i.test(fp.charAt(0)) && fp.charAt(1) === ":" && fp.charAt(2) === "\\") {
        return true;
      }
      if (fp.slice(0, 2) === "\\\\") {
        return true;
      }
      return !isRelative(fp);
    };
  }
});

// server/seasubs-xz.mjs
var seasubs_xz_exports = {};
__export(seasubs_xz_exports, {
  decode: () => decode
});
module.exports = __toCommonJS(seasubs_xz_exports);
var import_buffer = require("buffer");

// node_modules/async-compat/dist/esm/asyncValue.js
var import_is_error = __toESM(require_is_error(), 1);

// node_modules/is-promise/index.mjs
function isPromise(obj) {
  return !!obj && (typeof obj === "object" || typeof obj === "function") && typeof obj.then === "function";
}

// node_modules/async-compat/dist/esm/asyncValue.js
function asyncValue(value, callback) {
  if ((0, import_is_error.default)(value)) return callback(value);
  if (isPromise(value)) {
    return value.then((result) => {
      callback(void 0, result);
    }).catch((err) => {
      callback(err);
    });
  }
  return callback(void 0, value);
}

// node_modules/async-compat/dist/esm/asyncFunction.js
function asyncFunction(fn, useCallback, arg1, arg2, arg3, arg4, arg5, arg6, ..._args) {
  const callback = arguments[arguments.length - 1];
  const wrapper = (err, result) => {
    err ? callback(err) : asyncValue(result, callback);
  };
  if (useCallback) {
    switch (arguments.length) {
      case 3:
        fn(wrapper);
        return;
      case 4:
        fn(arg1, wrapper);
        return;
      case 5:
        fn(arg1, arg2, wrapper);
        return;
      case 6:
        fn(arg1, arg2, arg3, wrapper);
        return;
      case 7:
        fn(arg1, arg2, arg3, arg4, wrapper);
        return;
      case 8:
        fn(arg1, arg2, arg3, arg4, arg5, wrapper);
        return;
      case 9:
        fn(arg1, arg2, arg3, arg4, arg5, arg6, wrapper);
        return;
      default: {
        const args = Array.prototype.slice.call(arguments, 2);
        args[args.length - 1] = wrapper;
        fn.apply(null, args);
        return;
      }
    }
  }
  switch (arguments.length) {
    case 3:
      wrapper(void 0, fn());
      return;
    case 4:
      wrapper(void 0, fn(arg1));
      return;
    case 5:
      wrapper(void 0, fn(arg1, arg2));
      return;
    case 6:
      wrapper(void 0, fn(arg1, arg2, arg3));
      return;
    case 7:
      wrapper(void 0, fn(arg1, arg2, arg3, arg4));
      return;
    case 8:
      wrapper(void 0, fn(arg1, arg2, arg3, arg4, arg5));
      return;
    case 9:
      wrapper(void 0, fn(arg1, arg2, arg3, arg4, arg5, arg6));
      return;
    default: {
      const args = Array.prototype.slice.call(arguments, 2);
      args.pop();
      wrapper(void 0, fn.apply(null, args));
      return;
    }
  }
}

// node_modules/async-compat/dist/esm/defaultValue.js
function defaultValue(result, value) {
  return result === void 0 ? value : result;
}

// node_modules/async-compat/dist/esm/index.js
var esm_default = {
  asyncFunction,
  asyncValue,
  defaultValue
};

// node_modules/iterator-next-callback/dist/esm/index.js
function iteratorNextCallback(iterator) {
  if (typeof Symbol !== "undefined" && Symbol.asyncIterator && iterator[Symbol.asyncIterator]) {
    return function nextAsyncIterable(callback) {
      iterator[Symbol.asyncIterator]().next().then((result) => {
        callback(void 0, result);
      }).catch((err) => {
        callback(err);
      });
    };
  }
  return function AsyncIterator(callback) {
    const result = iterator.next();
    if (isPromise(result)) {
      result.then((result2) => {
        callback(void 0, result2);
      }).catch((err) => {
        callback(err);
      });
    } else {
      callback(void 0, result);
    }
  };
}

// node_modules/maximize-iterator/dist/esm/createProcessor.js
var isError2 = (err) => !!err && err.stack !== void 0 && err.message !== void 0;
function processDone(err, options, callback) {
  if (err) options.err = options.err || err;
  options.done = true;
  if (!options.done || options.counter > 0) return false;
  callback(options.err, options.done);
  return true;
}
function processResult(err, keep, options, callback) {
  var _options_error;
  options.counter--;
  if (err && esm_default.defaultValue((_options_error = options.error) === null || _options_error === void 0 ? void 0 : _options_error.call(options, err), false) || !err && !esm_default.defaultValue(keep, true)) {
    if (err) options.err = options.err || err;
    options.done = true;
  }
  if (!options.done || options.counter > 0) return false;
  callback(options.err, options.done);
  return true;
}
function createProcessor(next, options, callback) {
  let flushing = false;
  function callDefer(err, keep) {
    const shouldContinue = !processResult(err, keep, options, callback);
    if (flushing) return;
    if (shouldContinue) flush();
  }
  function flush() {
    flushing = true;
    while (options.counter < options.concurrency) {
      if (options.done || !options.canProcess()) break;
      if (options.total >= options.limit) {
        processDone(void 0, options, callback);
        flushing = false;
        return;
      }
      options.total++;
      options.counter++;
      next((err, result) => {
        if (err || !result || result.done) {
          return callDefer(err, false);
        }
        esm_default.asyncFunction(options.each, !!options.callbacks, result.value, (err2, keep) => callDefer(err2, keep));
      });
    }
    flushing = false;
  }
  return function processor(doneOrError) {
    const error = doneOrError;
    if (doneOrError && processDone(isError2(error) ? error : void 0, options, callback)) return;
    flush();
  };
}

// node_modules/stack-base-iterator/dist/esm/index.js
var import_pinkie_promise = __toESM(require_pinkie_promise(), 1);

// node_modules/stack-base-iterator/dist/esm/LinkedList.js
var Node = class Node2 {
  constructor(value) {
    this.value = value;
    this.prev = null;
    this.next = null;
  }
};
var LinkedList = class LinkedList2 {
  last() {
    return this.tail ? this.tail.value : void 0;
  }
  push(value) {
    const newNode = new Node(value);
    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.prev = this.tail;
      this.tail.next = newNode;
      this.tail = newNode;
    }
    this.length++;
    return this;
  }
  pop() {
    if (!this.head) return void 0;
    const poppedNode = this.tail;
    if (this.length === 1) {
      this.head = null;
      this.tail = null;
    } else {
      this.tail = poppedNode.prev;
      this.tail.next = null;
      poppedNode.prev = null;
    }
    this.length--;
    return poppedNode.value;
  }
  remove(value) {
    if (!this.head) return void 0;
    let currentNode = this.head;
    while (currentNode) {
      if (currentNode.value === value) {
        if (currentNode === this.head) {
          this.head = currentNode.next;
          if (this.head) this.head.prev = null;
          else this.tail = null;
        } else if (currentNode === this.tail) {
          this.tail = currentNode.prev;
          this.tail.next = null;
        } else {
          currentNode.prev.next = currentNode.next;
          currentNode.next.prev = currentNode.prev;
        }
        this.length--;
        return currentNode.value;
      }
      currentNode = currentNode.next;
    }
    return void 0;
  }
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }
};

// node_modules/stack-base-iterator/dist/esm/lib/defer.js
var defer = typeof setImmediate !== "undefined" ? setImmediate : (fn) => setTimeout(fn, 0);

// node_modules/stack-base-iterator/dist/esm/index.js
var root = typeof window === "undefined" ? global : window;
var Symbol2 = typeof root.Symbol === "undefined" ? {
  asyncIterator: void 0
} : root.Symbol;
var StackBaseIterator = class StackBaseIterator2 {
  isDone() {
    return this.done;
  }
  push(fn, ...rest) {
    if (this.done) return console.log("Attempting to push on a done iterator");
    this.stack.push(fn);
    !rest.length || rest.forEach((x) => {
      this.stack.push(x);
    });
    this._pump();
  }
  next() {
    return new import_pinkie_promise.default((resolve, reject) => {
      this._processOrQueue((err, result) => {
        err ? reject(err) : resolve(result);
      });
    });
  }
  [Symbol2.asyncIterator]() {
    return this;
  }
  forEach(fn, options, callback) {
    if (typeof fn !== "function") throw new Error("Missing each function");
    callback = typeof options === "function" ? options : callback;
    options = typeof options === "function" ? {} : options || {};
    if (typeof callback === "function") {
      if (this.done) return callback(void 0, true);
      const processorOptions = {
        each: fn,
        callbacks: options.callbacks || false,
        concurrency: options.concurrency || 1,
        limit: options.limit || Infinity,
        error: options.error || function defaultError() {
          return true;
        },
        total: 0,
        counter: 0,
        canProcess: () => {
          return !this.done && this.stack.length > 0 && this.queued.length < this.stack.length;
        }
      };
      let callbackFired = false;
      const processor = createProcessor(iteratorNextCallback(this), processorOptions, (err) => {
        if (callbackFired) return;
        callbackFired = true;
        defer(() => {
          if (!this.destroyed) this.processors.remove(processor);
          const done = !this.stack.length && this.pending === 0;
          if ((err || done) && !this.done) this.end(err);
          callback(err, this.done || done);
        });
      });
      this.processors.push(processor);
      this._pump();
      return;
    }
    return new Promise((resolve, reject) => this.forEach(fn, options, (err, done) => err ? reject(err) : resolve(done)));
  }
  end(err) {
    var _this_processors_pop, _this_processing_pop, _this_processing_pop1, _this_queued_pop, _this_queued_pop1;
    if (this.done) return;
    this.done = true;
    while (this.processors.length > 0) (_this_processors_pop = this.processors.pop()) === null || _this_processors_pop === void 0 ? void 0 : _this_processors_pop(err || true);
    while (this.processing.length > 0) err ? (_this_processing_pop = this.processing.pop()) === null || _this_processing_pop === void 0 ? void 0 : _this_processing_pop(err) : (_this_processing_pop1 = this.processing.pop()) === null || _this_processing_pop1 === void 0 ? void 0 : _this_processing_pop1(void 0, {
      done: true,
      value: null
    });
    while (this.queued.length > 0) err ? (_this_queued_pop = this.queued.pop()) === null || _this_queued_pop === void 0 ? void 0 : _this_queued_pop(err) : (_this_queued_pop1 = this.queued.pop()) === null || _this_queued_pop1 === void 0 ? void 0 : _this_queued_pop1(void 0, {
      done: true,
      value: null
    });
    while (this.stack.length > 0) this.stack.pop();
  }
  destroy(err) {
    if (this.destroyed) throw new Error("Already destroyed");
    this.destroyed = true;
    this.end(err);
  }
  _pump() {
    var _this_processors_last;
    if (this.flushing) return;
    this.flushing = true;
    if (!this.done && this.processors.length > 0 && this.stack.length > 0 && this.stack.length > this.queued.length) (_this_processors_last = this.processors.last()) === null || _this_processors_last === void 0 ? void 0 : _this_processors_last(false);
    while (this.stack.length > 0 && this.queued.length > 0) {
      var _this_processors_last1;
      this._processOrQueue(this.queued.pop());
      if (!this.done && this.processors.length > 0 && this.stack.length > 0 && this.stack.length > this.queued.length) (_this_processors_last1 = this.processors.last()) === null || _this_processors_last1 === void 0 ? void 0 : _this_processors_last1(false);
    }
    this.flushing = false;
  }
  _scheduleEndCheck() {
    if (this.endScheduled || this.done) return;
    this.endScheduled = true;
    defer(() => {
      this.endScheduled = false;
      if (this.stack.length === 0 && this.processing.length === 0 && this.pending === 0 && !this.done) {
        this.end();
      }
    });
  }
  _processOrQueue(callback) {
    if (this.done) return callback(void 0, {
      done: true,
      value: null
    });
    if (this.stack.length === 0) {
      this.queued.push(callback);
      return;
    }
    const next = this.stack.pop();
    this.processing.push(callback);
    this.pending++;
    let callbackFired = false;
    next === null || next === void 0 ? void 0 : next(this, (err, result) => {
      var _this_options_error, _this_options;
      if (callbackFired) {
        console.warn("stack-base-iterator: callback called multiple times - this indicates a bug in the iterator implementation");
        return;
      }
      callbackFired = true;
      this.pending--;
      this.processing.remove(callback);
      if (this.done) return callback(void 0, {
        done: true,
        value: null
      });
      if (err && esm_default.defaultValue((_this_options_error = (_this_options = this.options).error) === null || _this_options_error === void 0 ? void 0 : _this_options_error.call(_this_options, err), true)) err = void 0;
      if (err) callback(err);
      else if (!result) {
        this.queued.push(callback);
        defer(() => this._pump());
      } else callback(void 0, result);
      if (this.stack.length === 0 && this.processing.length === 0 && this.pending === 0) {
        this._scheduleEndCheck();
      }
    });
  }
  constructor(options = {}) {
    this.options = {
      ...options
    };
    this.options.error = options.error || function defaultError(err) {
      return !!err;
    };
    this.done = false;
    this.stack = [];
    this.queued = [];
    this.processors = new LinkedList();
    this.processing = new LinkedList();
    this.flushing = false;
    this.pending = 0;
    this.endScheduled = false;
  }
};

// node_modules/extract-base-iterator/dist/esm/DirectoryEntry.js
var import_mkdirp_classic = __toESM(require_mkdirp_classic(), 1);

// node_modules/extract-base-iterator/dist/esm/fs/chmod.js
var UMASK = process.umask ? process.umask() : null;

// node_modules/extract-base-iterator/dist/esm/fs/chown.js
var UID = process.getuid ? process.getuid() : -1;
var OWN = process.platform !== "win32" && UID === 0;

// node_modules/extract-base-iterator/dist/esm/shared/compat.js
var import_module = __toESM(require("module"), 1);
var import_meta = {};
var _require = typeof require === "undefined" ? import_module.default.createRequire(import_meta.url) : require;
var hasBufferAlloc = typeof Buffer.alloc === "function";
var hasBufferAllocUnsafe = typeof Buffer.allocUnsafe === "function";
var hasBufferFrom = typeof Buffer.from === "function" && Buffer.from !== Uint8Array.from;
var MAX_SAFE_BUFFER_LENGTH = 256 * 1024 * 1024;
var DETECTED_MAX_LENGTH = null;
function getMaxBufferLength() {
  if (DETECTED_MAX_LENGTH !== null) return DETECTED_MAX_LENGTH;
  const maxLen = Buffer.kMaxLength;
  if (maxLen !== void 0) {
    DETECTED_MAX_LENGTH = maxLen;
  } else {
    const nodeVersion = parseInt(process.version.slice(1).split(".")[0], 10);
    if (nodeVersion >= 8) {
      DETECTED_MAX_LENGTH = Number.MAX_SAFE_INTEGER;
    } else {
      DETECTED_MAX_LENGTH = 1073741823;
    }
  }
  return DETECTED_MAX_LENGTH;
}
function canAllocateBufferSize(size) {
  return size >= 0 && size <= MAX_SAFE_BUFFER_LENGTH;
}
function createChunk(size, zeroFill) {
  if (hasBufferAlloc) {
    return Buffer.alloc(size);
  }
  const buf = new Buffer(size);
  if (zeroFill) buf.fill(0);
  return buf;
}
function combineBuffersPairwise(buffers) {
  const maxLength = getMaxBufferLength();
  let totalSize = 0;
  for (let i = 0; i < buffers.length; i++) {
    totalSize += buffers[i].length;
  }
  if (totalSize > maxLength) {
    throw new Error(`Cannot combine buffers: total size (${totalSize} bytes) exceeds Node.js buffer limit (${maxLength} bytes). LZMA1 archives with folders larger than ${Math.floor(maxLength / 1024 / 1024)}MB cannot be processed on this Node version.`);
  }
  const result = createChunk(totalSize, false);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    buffers[i].copy(result, offset);
    offset += buffers[i].length;
  }
  return result;
}
function allocBufferLarge(size, zeroFill) {
  const numChunks = Math.ceil(size / MAX_SAFE_BUFFER_LENGTH);
  const chunks = [];
  for (let i = 0; i < numChunks; i++) {
    const chunkSize = Math.min(MAX_SAFE_BUFFER_LENGTH, size - i * MAX_SAFE_BUFFER_LENGTH);
    chunks.push(createChunk(chunkSize, zeroFill));
  }
  return combineBuffersPairwise(chunks);
}
function allocBuffer(size) {
  if (size === 0) {
    return new Buffer(0);
  }
  if (canAllocateBufferSize(size)) {
    if (hasBufferAlloc) {
      return Buffer.alloc(size);
    }
    const buf = new Buffer(size);
    buf.fill(0);
    return buf;
  }
  return allocBufferLarge(size, true);
}
function allocBufferUnsafe(size) {
  if (size === 0) {
    return new Buffer(0);
  }
  if (canAllocateBufferSize(size)) {
    if (hasBufferAllocUnsafe) {
      return Buffer.allocUnsafe(size);
    }
    return new Buffer(size);
  }
  return allocBufferLarge(size, false);
}
function bufferFrom(data, encoding) {
  if (hasBufferFrom) {
    if (typeof data === "string") {
      return Buffer.from(data, encoding);
    }
    return Buffer.from(data);
  }
  if (data instanceof Uint8Array && !(data instanceof Buffer)) {
    const arr = [];
    for (let i = 0; i < data.length; i++) {
      arr.push(data[i]);
    }
    return new Buffer(arr);
  }
  return new Buffer(data, encoding);
}
function bufferConcat(list, totalLength) {
  let actualLength = 0;
  for (let i = 0; i < list.length; i++) {
    actualLength += list[i].length;
  }
  const targetLength = totalLength !== void 0 ? totalLength : actualLength;
  if (list.length === 0) {
    return new Buffer(0);
  }
  if (targetLength <= MAX_SAFE_BUFFER_LENGTH) {
    let allBuffers = true;
    for (let j = 0; j < list.length; j++) {
      if (!(list[j] instanceof Buffer)) {
        allBuffers = false;
        break;
      }
    }
    if (allBuffers && targetLength >= actualLength) {
      return Buffer.concat(list, targetLength);
    }
  }
  const result = allocBuffer(targetLength);
  let offset = 0;
  for (let k = 0; k < list.length && offset < targetLength; k++) {
    const buf = list[k];
    const toCopy = Math.min(buf.length, targetLength - offset);
    if (buf instanceof Buffer) {
      buf.copy(result, offset, 0, toCopy);
    } else {
      for (let l = 0; l < toCopy; l++) {
        result[offset + l] = buf[l];
      }
    }
    offset += toCopy;
  }
  return result;
}
var hasStartsWith = typeof String.prototype.startsWith === "function";
var zlib = null;
try {
  zlib = _require("zlib");
} catch (_e) {
}
var hasNativeInflateRaw = zlib !== null && typeof zlib.inflateRawSync === "function";
var hasNativeStreamingInflate = zlib !== null && typeof zlib.createInflateRaw === "function";
var major = +process.versions.node.split(".")[0];
var Readable = major > 0 ? _require("stream").Readable : _require("readable-stream").Readable;
var Writable = major > 0 ? _require("stream").Writable : _require("readable-stream").Writable;
var Transform = major > 0 ? _require("stream").Transform : _require("readable-stream").Transform;
var PassThrough = major > 0 ? _require("stream").PassThrough : _require("readable-stream").PassThrough;

// node_modules/extract-base-iterator/dist/esm/shared/crc32.js
var CRC32_TABLE = [];
(function initTable() {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      if ((c & 1) !== 0) {
        c = 3988292384 ^ c >>> 1;
      } else {
        c = c >>> 1;
      }
    }
    CRC32_TABLE[i] = c >>> 0;
  }
})();

// node_modules/extract-base-iterator/dist/esm/shared/EntryStream.js
var import_stream = __toESM(require("stream"), 1);
var major2 = +process.versions.node.split(".")[0];
var ReadableBase;
if (major2 > 0) {
  ReadableBase = import_stream.default.Readable;
} else {
  ReadableBase = require_readable().Readable;
}

// node_modules/extract-base-iterator/dist/esm/waitForAccess.js
var import_graceful_fs = __toESM(require_graceful_fs(), 1);

// node_modules/fs-remove-compat/dist/esm/rm.js
var import_fs = __toESM(require("fs"), 1);

// node_modules/fs-remove-compat/dist/esm/lib/path.js
var HAS_BUFFER_PATHS = parseInt(process.versions.node.split(".")[0], 10) >= 6;
var IS_WIN32 = process.platform === "win32";

// node_modules/fs-remove-compat/dist/esm/lib/platform.js
var _process_env_OSTYPE;
var isWindows = process.platform === "win32" || /^(msys|cygwin)$/.test((_process_env_OSTYPE = process.env.OSTYPE) !== null && _process_env_OSTYPE !== void 0 ? _process_env_OSTYPE : "");

// node_modules/fs-remove-compat/dist/esm/fallback/errors.js
var import_os = __toESM(require("os"), 1);
var EISDIR_ERRNO = typeof import_os.default.constants === "object" ? import_os.default.constants.errno.EISDIR : 21;

// node_modules/fs-remove-compat/dist/esm/rm.js
var HAS_NATIVE_RM = typeof import_fs.default.rm === "function";

// node_modules/fs-remove-compat/dist/esm/rmSync.js
var import_fs2 = __toESM(require("fs"), 1);
var HAS_NATIVE_RM_SYNC = typeof import_fs2.default.rmSync === "function";

// node_modules/extract-base-iterator/dist/esm/FileEntry.js
var import_graceful_fs2 = __toESM(require_graceful_fs(), 1);
var import_mkdirp_classic2 = __toESM(require_mkdirp_classic(), 1);

// node_modules/extract-base-iterator/dist/esm/LinkEntry.js
var import_is_absolute = __toESM(require_is_absolute(), 1);
var import_mkdirp_classic3 = __toESM(require_mkdirp_classic(), 1);

// node_modules/extract-base-iterator/dist/esm/SymbolicLinkEntry.js
var import_is_absolute2 = __toESM(require_is_absolute(), 1);
var import_mkdirp_classic4 = __toESM(require_mkdirp_classic(), 1);

// node_modules/extract-base-iterator/dist/esm/fs/lutimes.js
var import_fs3 = __toESM(require("fs"), 1);
var HAS_LUTIMES = typeof import_fs3.default.lutimes === "function";

// node_modules/extract-base-iterator/dist/esm/SymbolicLinkEntry.js
var _process_env_OSTYPE2;
var isWindows2 = process.platform === "win32" || /^(msys|cygwin)$/.test((_process_env_OSTYPE2 = process.env.OSTYPE) !== null && _process_env_OSTYPE2 !== void 0 ? _process_env_OSTYPE2 : "");

// node_modules/xz-compat/dist/esm/lzma/lib/Lzma2ChunkParser.js
function readByte(input, offset) {
  return Buffer.isBuffer(input) ? input[offset] : input.readByte(offset);
}
function getLength(input) {
  return Buffer.isBuffer(input) ? input.length : input.length;
}
function parseLzma2ChunkHeader(input, offset) {
  const len = getLength(input);
  if (offset >= len) {
    return {
      success: false,
      needBytes: 1
    };
  }
  const control = readByte(input, offset);
  if (control === 0) {
    return {
      success: true,
      chunk: {
        type: "end",
        headerSize: 1,
        dictReset: false,
        stateReset: false,
        newProps: null,
        uncompSize: 0,
        compSize: 0
      }
    };
  }
  if (control === 1 || control === 2) {
    if (offset + 3 > len) {
      return {
        success: false,
        needBytes: 3 - (len - offset)
      };
    }
    const uncompSize = (readByte(input, offset + 1) << 8 | readByte(input, offset + 2)) + 1;
    return {
      success: true,
      chunk: {
        type: "uncompressed",
        headerSize: 3,
        dictReset: control === 1,
        stateReset: false,
        newProps: null,
        uncompSize,
        compSize: 0
      }
    };
  }
  if (control >= 128) {
    const hasNewProps = control >= 192;
    const minHeaderSize = hasNewProps ? 6 : 5;
    if (offset + minHeaderSize > len) {
      return {
        success: false,
        needBytes: minHeaderSize - (len - offset)
      };
    }
    const uncompHigh = control & 31;
    const uncompSize = (uncompHigh << 16 | readByte(input, offset + 1) << 8 | readByte(input, offset + 2)) + 1;
    const compSize = (readByte(input, offset + 3) << 8 | readByte(input, offset + 4)) + 1;
    let newProps = null;
    if (hasNewProps) {
      const propsByte = readByte(input, offset + 5);
      const lc = propsByte % 9;
      const remainder = ~~(propsByte / 9);
      const lp = remainder % 5;
      const pb = ~~(remainder / 5);
      newProps = {
        lc,
        lp,
        pb
      };
    }
    return {
      success: true,
      chunk: {
        type: "lzma",
        headerSize: minHeaderSize,
        dictReset: control >= 224,
        stateReset: control >= 160,
        newProps,
        uncompSize,
        compSize
      }
    };
  }
  throw new Error(`Invalid LZMA2 control byte: 0x${control.toString(16)}`);
}

// node_modules/xz-compat/dist/esm/lzma/types.js
var kNumStates = 12;
var kNumPosSlotBits = 6;
var kNumLenToPosStatesBits = 2;
var kNumLenToPosStates = 1 << kNumLenToPosStatesBits;
var kMatchMinLen = 2;
var kNumLowLenBits = 3;
var kNumMidLenBits = 3;
var kNumHighLenBits = 8;
var kNumLowLenSymbols = 1 << kNumLowLenBits;
var kNumMidLenSymbols = 1 << kNumMidLenBits;
var kNumLenSymbols = kNumLowLenSymbols + kNumMidLenSymbols + (1 << kNumHighLenBits);
var kMatchMaxLen = kMatchMinLen + kNumLenSymbols - 1;
var kNumAlignBits = 4;
var kAlignTableSize = 1 << kNumAlignBits;
var kAlignMask = kAlignTableSize - 1;
var kStartPosModelIndex = 4;
var kEndPosModelIndex = 14;
var kNumPosModels = kEndPosModelIndex - kStartPosModelIndex;
var kNumFullDistances = 1 << (kEndPosModelIndex >>> 1);
var kNumLitContextBitsMax = 8;
var kNumPosStatesBitsMax = 4;
var kNumPosStatesMax = 1 << kNumPosStatesBitsMax;
var kNumPosStatesBitsEncodingMax = 4;
var kNumPosStatesEncodingMax = 1 << kNumPosStatesBitsEncodingMax;
var kNumBitModelTotalBits = 11;
var kBitModelTotal = 1 << kNumBitModelTotalBits;
var kProbInitValue = kBitModelTotal >>> 1;
function stateUpdateChar(state) {
  if (state < 4) return 0;
  if (state < 10) return state - 3;
  return state - 6;
}
function stateUpdateMatch(state) {
  return state < 7 ? 7 : 10;
}
function stateUpdateRep(state) {
  return state < 7 ? 8 : 11;
}
function stateUpdateShortRep(state) {
  return state < 7 ? 9 : 11;
}
function stateIsCharState(state) {
  return state < 7;
}
function getLenToPosState(len) {
  len -= kMatchMinLen;
  return len < kNumLenToPosStates ? len : kNumLenToPosStates - 1;
}
function initBitModels(probs, count) {
  if (probs === null) {
    if (count === void 0) {
      throw new Error("count required when probs is null");
    }
    probs = new Uint16Array(count);
  }
  for (let i = 0; i < probs.length; i++) {
    probs[i] = kProbInitValue;
  }
  return probs;
}
function parseProperties(properties) {
  if (properties.length < 5) {
    throw new Error("LZMA properties must be at least 5 bytes");
  }
  const d = properties[0] & 255;
  const lc = d % 9;
  const remainder = ~~(d / 9);
  const lp = remainder % 5;
  const pb = ~~(remainder / 5);
  if (lc > kNumLitContextBitsMax || lp > 4 || pb > kNumPosStatesBitsMax) {
    throw new Error("Invalid LZMA properties");
  }
  let dictionarySize = 0;
  for (let i = 0; i < 4; i++) {
    dictionarySize |= (properties[1 + i] & 255) << i * 8;
  }
  return {
    lc,
    lp,
    pb,
    dictionarySize
  };
}
function parseLzma2DictionarySize(prop) {
  if (prop > 40) {
    throw new Error("Invalid LZMA2 dictionary size property");
  }
  if (prop === 40) {
    return 4294967295;
  }
  const base = 2 | prop & 1;
  const exp = (prop >>> 1) + 11;
  return base << exp;
}

// node_modules/xz-compat/dist/esm/lzma/sync/RangeDecoder.js
var RangeDecoder = class {
  /**
  * Set input buffer and initialize decoder state
  */
  setInput(input, offset = 0) {
    this.pos = offset;
    this.getByte = Buffer.isBuffer(input) ? (o) => input[o] : (o) => input.readByte(o);
    this.init();
  }
  /**
  * Initialize range decoder (reads first 5 bytes)
  */
  init() {
    this.code = 0;
    this.range = -1;
    this.pos++;
    for (let i = 0; i < 4; i++) {
      this.code = this.code << 8 | this.getByte(this.pos++);
    }
  }
  /**
  * Get current position in input buffer
  */
  getPosition() {
    return this.pos;
  }
  /**
  * Normalize range if needed (read more bytes)
  */
  normalize() {
    if ((this.range & 4278190080) === 0) {
      this.code = this.code << 8 | this.getByte(this.pos++);
      this.range <<= 8;
    }
  }
  /**
  * Decode a single bit using probability model
  * @param probs - Probability array
  * @param index - Index into probability array
  * @returns Decoded bit (0 or 1)
  */
  decodeBit(probs, index) {
    const prob = probs[index];
    const newBound = (this.range >>> 11) * prob;
    if ((this.code ^ 2147483648) < (newBound ^ 2147483648)) {
      this.range = newBound;
      probs[index] += 2048 - prob >>> 5;
      this.normalize();
      return 0;
    }
    this.range -= newBound;
    this.code -= newBound;
    probs[index] -= prob >>> 5;
    this.normalize();
    return 1;
  }
  /**
  * Decode direct bits (not probability-based)
  * @param numTotalBits - Number of bits to decode
  * @returns Decoded value
  */
  decodeDirectBits(numTotalBits) {
    let result = 0;
    for (let i = numTotalBits; i > 0; i--) {
      this.range >>>= 1;
      const t = this.code - this.range >>> 31;
      this.code -= this.range & t - 1;
      result = result << 1 | 1 - t;
      this.normalize();
    }
    return result;
  }
  constructor() {
    this.pos = 0;
    this.code = 0;
    this.range = 0;
    this.getByte = () => 0;
  }
};
var BitTreeDecoder = class {
  /**
  * Initialize probability models
  */
  init() {
    for (let i = 0; i < this.models.length; i++) {
      this.models[i] = 1024;
    }
  }
  /**
  * Decode a symbol (forward bit order)
  */
  decode(rangeDecoder) {
    let m = 1;
    for (let i = this.numBitLevels; i > 0; i--) {
      m = m << 1 | rangeDecoder.decodeBit(this.models, m);
    }
    return m - (1 << this.numBitLevels);
  }
  /**
  * Decode a symbol (reverse bit order)
  */
  reverseDecode(rangeDecoder) {
    let m = 1;
    let symbol = 0;
    for (let i = 0; i < this.numBitLevels; i++) {
      const bit = rangeDecoder.decodeBit(this.models, m);
      m = m << 1 | bit;
      symbol |= bit << i;
    }
    return symbol;
  }
  constructor(numBitLevels) {
    this.numBitLevels = numBitLevels;
    this.models = new Uint16Array(1 << numBitLevels);
    this.init();
  }
};
function reverseDecodeFromArray(models, startIndex, rangeDecoder, numBitLevels) {
  let m = 1;
  let symbol = 0;
  for (let i = 0; i < numBitLevels; i++) {
    const bit = rangeDecoder.decodeBit(models, startIndex + m);
    m = m << 1 | bit;
    symbol |= bit << i;
  }
  return symbol;
}

// node_modules/xz-compat/dist/esm/lzma/sync/LzmaDecoder.js
var LenDecoder = class LenDecoder2 {
  create(numPosStates) {
    for (; this.numPosStates < numPosStates; this.numPosStates++) {
      this.lowCoder[this.numPosStates] = new BitTreeDecoder(3);
      this.midCoder[this.numPosStates] = new BitTreeDecoder(3);
    }
  }
  init() {
    initBitModels(this.choice);
    for (let i = this.numPosStates - 1; i >= 0; i--) {
      this.lowCoder[i].init();
      this.midCoder[i].init();
    }
    this.highCoder.init();
  }
  decode(rangeDecoder, posState) {
    if (rangeDecoder.decodeBit(this.choice, 0) === 0) {
      return this.lowCoder[posState].decode(rangeDecoder);
    }
    if (rangeDecoder.decodeBit(this.choice, 1) === 0) {
      return 8 + this.midCoder[posState].decode(rangeDecoder);
    }
    return 16 + this.highCoder.decode(rangeDecoder);
  }
  constructor() {
    this.choice = initBitModels(null, 2);
    this.lowCoder = [];
    this.midCoder = [];
    this.highCoder = new BitTreeDecoder(8);
    this.numPosStates = 0;
  }
};
var LiteralDecoder2 = class LiteralDecoder22 {
  init() {
    initBitModels(this.decoders);
  }
  decodeNormal(rangeDecoder) {
    let symbol = 1;
    do {
      symbol = symbol << 1 | rangeDecoder.decodeBit(this.decoders, symbol);
    } while (symbol < 256);
    return symbol & 255;
  }
  decodeWithMatchByte(rangeDecoder, matchByte) {
    let symbol = 1;
    do {
      const matchBit = matchByte >> 7 & 1;
      matchByte <<= 1;
      const bit = rangeDecoder.decodeBit(this.decoders, (1 + matchBit << 8) + symbol);
      symbol = symbol << 1 | bit;
      if (matchBit !== bit) {
        while (symbol < 256) {
          symbol = symbol << 1 | rangeDecoder.decodeBit(this.decoders, symbol);
        }
        break;
      }
    } while (symbol < 256);
    return symbol & 255;
  }
  constructor() {
    this.decoders = initBitModels(null, 768);
  }
};
var LiteralDecoder = class LiteralDecoder3 {
  create(numPosBits, numPrevBits) {
    if (this.coders.length > 0 && this.numPrevBits === numPrevBits && this.numPosBits === numPosBits) {
      return;
    }
    this.numPosBits = numPosBits;
    this.posMask = (1 << numPosBits) - 1;
    this.numPrevBits = numPrevBits;
    this.coders = [];
  }
  init() {
    for (let i = 0; i < this.coders.length; i++) {
      if (this.coders[i]) {
        var _this_coders_i;
        (_this_coders_i = this.coders[i]) === null || _this_coders_i === void 0 ? void 0 : _this_coders_i.init();
      }
    }
  }
  getDecoder(pos, prevByte) {
    const index = ((pos & this.posMask) << this.numPrevBits) + ((prevByte & 255) >>> 8 - this.numPrevBits);
    let decoder = this.coders[index];
    if (!decoder) {
      decoder = new LiteralDecoder2();
      this.coders[index] = decoder;
    }
    return decoder;
  }
  constructor() {
    this.numPosBits = 0;
    this.numPrevBits = 0;
    this.posMask = 0;
    this.coders = [];
  }
};
var OutWindow = class OutWindow2 {
  create(windowSize) {
    if (!this.buffer || this.windowSize !== windowSize) {
      this.buffer = allocBufferUnsafe(windowSize);
    }
    this.windowSize = windowSize;
    this.pos = 0;
    this.streamPos = 0;
  }
  init(solid) {
    if (!solid) {
      this.pos = 0;
      this.streamPos = 0;
    }
  }
  putByte(b) {
    this.buffer[this.pos++] = b;
    if (this.pos >= this.windowSize) {
      if (this.sink) {
        this.flush();
        this.pos = 0;
        this.streamPos = 0;
      } else {
        this.pos = 0;
      }
    }
  }
  flush() {
    const size = this.pos - this.streamPos;
    if (size > 0 && this.sink) {
      const chunk = bufferFrom(this.buffer.slice(this.streamPos, this.streamPos + size));
      this.sink.write(chunk);
      this.streamPos = this.pos;
    }
  }
  getByte(distance) {
    let pos = this.pos - distance - 1;
    if (pos < 0) {
      pos += this.windowSize;
    }
    return this.buffer[pos];
  }
  copyBlock(distance, len) {
    let pos = this.pos - distance - 1;
    if (pos < 0) {
      pos += this.windowSize;
    }
    for (let i = 0; i < len; i++) {
      if (pos >= this.windowSize) {
        pos = 0;
      }
      this.putByte(this.buffer[pos++]);
    }
  }
  /**
  * Copy decoded data to output buffer
  */
  copyTo(output, outputOffset, count) {
    const srcPos = this.pos - count;
    if (srcPos < 0) {
      const firstPart = -srcPos;
      this.buffer.copy(output, outputOffset, this.windowSize + srcPos, this.windowSize);
      this.buffer.copy(output, outputOffset + firstPart, 0, count - firstPart);
    } else {
      this.buffer.copy(output, outputOffset, srcPos, srcPos + count);
    }
  }
  constructor(sink) {
    this.buffer = allocBufferUnsafe(0);
    this.windowSize = 0;
    this.pos = 0;
    this.sink = sink;
    this.streamPos = 0;
  }
};
var LzmaDecoder = class {
  /**
  * Set dictionary size
  */
  setDictionarySize(dictionarySize) {
    if (dictionarySize < 0) return false;
    if (this.dictionarySize !== dictionarySize) {
      this.dictionarySize = dictionarySize;
      this.dictionarySizeCheck = Math.max(dictionarySize, 1);
      this.outWindow.create(Math.max(this.dictionarySizeCheck, 1 << 12));
    }
    return true;
  }
  /**
  * Set lc, lp, pb properties
  */
  setLcLpPb(lc, lp, pb) {
    if (lc > kNumLitContextBitsMax || lp > 4 || pb > kNumPosStatesBitsMax) {
      return false;
    }
    const numPosStates = 1 << pb;
    this.literalDecoder.create(lp, lc);
    this.lenDecoder.create(numPosStates);
    this.repLenDecoder.create(numPosStates);
    this.posStateMask = numPosStates - 1;
    return true;
  }
  /**
  * Set decoder properties from 5-byte buffer
  */
  setDecoderProperties(properties) {
    const props = parseProperties(properties);
    if (!this.setLcLpPb(props.lc, props.lp, props.pb)) return false;
    return this.setDictionarySize(props.dictionarySize);
  }
  /**
  * Initialize probability tables
  */
  initProbabilities() {
    initBitModels(this.isMatchDecoders);
    initBitModels(this.isRepDecoders);
    initBitModels(this.isRepG0Decoders);
    initBitModels(this.isRepG1Decoders);
    initBitModels(this.isRepG2Decoders);
    initBitModels(this.isRep0LongDecoders);
    initBitModels(this.posDecoders);
    this.literalDecoder.init();
    for (let i = kNumLenToPosStates - 1; i >= 0; i--) {
      this.posSlotDecoder[i].init();
    }
    this.lenDecoder.init();
    this.repLenDecoder.init();
    this.posAlignDecoder.init();
  }
  /**
  * Reset probabilities only (for LZMA2 state reset)
  */
  resetProbabilities() {
    this.initProbabilities();
    this.state = 0;
    this.rep0 = 0;
    this.rep1 = 0;
    this.rep2 = 0;
    this.rep3 = 0;
  }
  /**
  * Reset dictionary position (for LZMA2 dictionary reset)
  */
  resetDictionary() {
    this.outWindow.init(false);
    this.totalPos = 0;
  }
  /**
  * Feed uncompressed data into the dictionary (for LZMA2 uncompressed chunks)
  * This updates the sliding window so subsequent LZMA chunks can reference this data.
  */
  feedUncompressed(data) {
    for (let i = 0; i < data.length; i++) {
      this.outWindow.putByte(data[i]);
    }
    this.totalPos += data.length;
    if (data.length > 0) {
      this.prevByte = data[data.length - 1];
    }
  }
  /**
  * Flush any remaining data in the OutWindow to the sink
  */
  flushOutWindow() {
    this.outWindow.flush();
  }
  /**
  * Decode LZMA data with streaming output (no buffer accumulation)
  * @param input - Compressed input buffer or BufferList
  * @param inputOffset - Offset into input buffer
  * @param outSize - Expected output size
  * @param solid - If true, preserve state from previous decode
  * @returns Number of bytes written to sink
  */
  decodeWithSink(input, inputOffset, outSize, solid = false) {
    this.rangeDecoder.setInput(input, inputOffset);
    if (!solid) {
      this.outWindow.init(false);
      this.initProbabilities();
      this.state = 0;
      this.rep0 = 0;
      this.rep1 = 0;
      this.rep2 = 0;
      this.rep3 = 0;
      this.prevByte = 0;
      this.totalPos = 0;
    } else {
      this.outWindow.init(true);
    }
    let outPos = 0;
    let cumPos = this.totalPos;
    while (outPos < outSize) {
      const posState = cumPos & this.posStateMask;
      if (this.rangeDecoder.decodeBit(this.isMatchDecoders, (this.state << kNumPosStatesBitsMax) + posState) === 0) {
        const decoder2 = this.literalDecoder.getDecoder(cumPos, this.prevByte);
        if (!stateIsCharState(this.state)) {
          this.prevByte = decoder2.decodeWithMatchByte(this.rangeDecoder, this.outWindow.getByte(this.rep0));
        } else {
          this.prevByte = decoder2.decodeNormal(this.rangeDecoder);
        }
        this.outWindow.putByte(this.prevByte);
        outPos++;
        this.state = stateUpdateChar(this.state);
        cumPos++;
      } else {
        let len;
        if (this.rangeDecoder.decodeBit(this.isRepDecoders, this.state) === 1) {
          len = 0;
          if (this.rangeDecoder.decodeBit(this.isRepG0Decoders, this.state) === 0) {
            if (this.rangeDecoder.decodeBit(this.isRep0LongDecoders, (this.state << kNumPosStatesBitsMax) + posState) === 0) {
              this.state = stateUpdateShortRep(this.state);
              len = 1;
            }
          } else {
            let distance;
            if (this.rangeDecoder.decodeBit(this.isRepG1Decoders, this.state) === 0) {
              distance = this.rep1;
            } else {
              if (this.rangeDecoder.decodeBit(this.isRepG2Decoders, this.state) === 0) {
                distance = this.rep2;
              } else {
                distance = this.rep3;
                this.rep3 = this.rep2;
              }
              this.rep2 = this.rep1;
            }
            this.rep1 = this.rep0;
            this.rep0 = distance;
          }
          if (len === 0) {
            len = kMatchMinLen + this.repLenDecoder.decode(this.rangeDecoder, posState);
            this.state = stateUpdateRep(this.state);
          }
        } else {
          this.rep3 = this.rep2;
          this.rep2 = this.rep1;
          this.rep1 = this.rep0;
          len = kMatchMinLen + this.lenDecoder.decode(this.rangeDecoder, posState);
          this.state = stateUpdateMatch(this.state);
          const posSlot = this.posSlotDecoder[getLenToPosState(len)].decode(this.rangeDecoder);
          if (posSlot >= kStartPosModelIndex) {
            const numDirectBits = (posSlot >> 1) - 1;
            this.rep0 = (2 | posSlot & 1) << numDirectBits;
            if (posSlot < kEndPosModelIndex) {
              this.rep0 += reverseDecodeFromArray(this.posDecoders, this.rep0 - posSlot - 1, this.rangeDecoder, numDirectBits);
            } else {
              this.rep0 += this.rangeDecoder.decodeDirectBits(numDirectBits - kNumAlignBits) << kNumAlignBits;
              this.rep0 += this.posAlignDecoder.reverseDecode(this.rangeDecoder);
              if (this.rep0 < 0) {
                if (this.rep0 === -1) break;
                throw new Error("LZMA: Invalid distance");
              }
            }
          } else {
            this.rep0 = posSlot;
          }
        }
        if (this.rep0 >= cumPos || this.rep0 >= this.dictionarySizeCheck) {
          throw new Error("LZMA: Invalid distance");
        }
        for (let i = 0; i < len; i++) {
          const b = this.outWindow.getByte(this.rep0);
          this.outWindow.putByte(b);
          outPos++;
        }
        cumPos += len;
        this.prevByte = this.outWindow.getByte(0);
      }
    }
    this.totalPos = cumPos;
    return outPos;
  }
  /**
  * Decode LZMA data directly into caller's buffer (zero-copy)
  * @param input - Compressed input buffer or BufferList
  * @param inputOffset - Offset into input buffer
  * @param outSize - Expected output size
  * @param output - Pre-allocated output buffer to write to
  * @param outputOffset - Offset in output buffer to start writing
  * @param solid - If true, preserve state from previous decode
  * @returns Number of bytes written
  */
  decodeToBuffer(input, inputOffset, outSize, output, outputOffset, solid = false) {
    this.rangeDecoder.setInput(input, inputOffset);
    if (!solid) {
      this.outWindow.init(false);
      this.initProbabilities();
      this.state = 0;
      this.rep0 = 0;
      this.rep1 = 0;
      this.rep2 = 0;
      this.rep3 = 0;
      this.prevByte = 0;
      this.totalPos = 0;
    } else {
      this.outWindow.init(true);
    }
    let outPos = outputOffset;
    const outEnd = outputOffset + outSize;
    let cumPos = this.totalPos;
    while (outPos < outEnd) {
      const posState = cumPos & this.posStateMask;
      if (this.rangeDecoder.decodeBit(this.isMatchDecoders, (this.state << kNumPosStatesBitsMax) + posState) === 0) {
        const decoder2 = this.literalDecoder.getDecoder(cumPos, this.prevByte);
        if (!stateIsCharState(this.state)) {
          this.prevByte = decoder2.decodeWithMatchByte(this.rangeDecoder, this.outWindow.getByte(this.rep0));
        } else {
          this.prevByte = decoder2.decodeNormal(this.rangeDecoder);
        }
        this.outWindow.putByte(this.prevByte);
        output[outPos++] = this.prevByte;
        this.state = stateUpdateChar(this.state);
        cumPos++;
      } else {
        let len;
        if (this.rangeDecoder.decodeBit(this.isRepDecoders, this.state) === 1) {
          len = 0;
          if (this.rangeDecoder.decodeBit(this.isRepG0Decoders, this.state) === 0) {
            if (this.rangeDecoder.decodeBit(this.isRep0LongDecoders, (this.state << kNumPosStatesBitsMax) + posState) === 0) {
              this.state = stateUpdateShortRep(this.state);
              len = 1;
            }
          } else {
            let distance;
            if (this.rangeDecoder.decodeBit(this.isRepG1Decoders, this.state) === 0) {
              distance = this.rep1;
            } else {
              if (this.rangeDecoder.decodeBit(this.isRepG2Decoders, this.state) === 0) {
                distance = this.rep2;
              } else {
                distance = this.rep3;
                this.rep3 = this.rep2;
              }
              this.rep2 = this.rep1;
            }
            this.rep1 = this.rep0;
            this.rep0 = distance;
          }
          if (len === 0) {
            len = kMatchMinLen + this.repLenDecoder.decode(this.rangeDecoder, posState);
            this.state = stateUpdateRep(this.state);
          }
        } else {
          this.rep3 = this.rep2;
          this.rep2 = this.rep1;
          this.rep1 = this.rep0;
          len = kMatchMinLen + this.lenDecoder.decode(this.rangeDecoder, posState);
          this.state = stateUpdateMatch(this.state);
          const posSlot = this.posSlotDecoder[getLenToPosState(len)].decode(this.rangeDecoder);
          if (posSlot >= kStartPosModelIndex) {
            const numDirectBits = (posSlot >> 1) - 1;
            this.rep0 = (2 | posSlot & 1) << numDirectBits;
            if (posSlot < kEndPosModelIndex) {
              this.rep0 += reverseDecodeFromArray(this.posDecoders, this.rep0 - posSlot - 1, this.rangeDecoder, numDirectBits);
            } else {
              this.rep0 += this.rangeDecoder.decodeDirectBits(numDirectBits - kNumAlignBits) << kNumAlignBits;
              this.rep0 += this.posAlignDecoder.reverseDecode(this.rangeDecoder);
              if (this.rep0 < 0) {
                if (this.rep0 === -1) break;
                throw new Error("LZMA: Invalid distance");
              }
            }
          } else {
            this.rep0 = posSlot;
          }
        }
        if (this.rep0 >= cumPos || this.rep0 >= this.dictionarySizeCheck) {
          throw new Error("LZMA: Invalid distance");
        }
        for (let i = 0; i < len; i++) {
          const b = this.outWindow.getByte(this.rep0);
          this.outWindow.putByte(b);
          output[outPos++] = b;
        }
        cumPos += len;
        this.prevByte = this.outWindow.getByte(0);
      }
    }
    this.totalPos = cumPos;
    return outPos - outputOffset;
  }
  /**
  * Decode LZMA data
  * @param input - Compressed input buffer or BufferList
  * @param inputOffset - Offset into input buffer
  * @param outSize - Expected output size
  * @param solid - If true, preserve state from previous decode
  * @returns Decompressed data
  */
  decode(input, inputOffset, outSize, solid = false) {
    const output = allocBufferUnsafe(outSize);
    this.decodeToBuffer(input, inputOffset, outSize, output, 0, solid);
    return output;
  }
  constructor(outputSink) {
    this.outWindow = new OutWindow(outputSink);
    this.rangeDecoder = new RangeDecoder();
    this.isMatchDecoders = initBitModels(null, kNumStates << kNumPosStatesBitsMax);
    this.isRepDecoders = initBitModels(null, kNumStates);
    this.isRepG0Decoders = initBitModels(null, kNumStates);
    this.isRepG1Decoders = initBitModels(null, kNumStates);
    this.isRepG2Decoders = initBitModels(null, kNumStates);
    this.isRep0LongDecoders = initBitModels(null, kNumStates << kNumPosStatesBitsMax);
    this.posSlotDecoder = [];
    this.posDecoders = initBitModels(null, kNumFullDistances - kEndPosModelIndex);
    this.posAlignDecoder = new BitTreeDecoder(kNumAlignBits);
    this.lenDecoder = new LenDecoder();
    this.repLenDecoder = new LenDecoder();
    this.literalDecoder = new LiteralDecoder();
    for (let i = 0; i < kNumLenToPosStates; i++) {
      this.posSlotDecoder[i] = new BitTreeDecoder(kNumPosSlotBits);
    }
    this.dictionarySize = -1;
    this.dictionarySizeCheck = -1;
    this.posStateMask = 0;
    this.state = 0;
    this.rep0 = 0;
    this.rep1 = 0;
    this.rep2 = 0;
    this.rep3 = 0;
    this.prevByte = 0;
    this.totalPos = 0;
  }
};

// node_modules/xz-compat/dist/esm/lzma/sync/Lzma2Decoder.js
function readBytes(input, offset, length) {
  if (Buffer.isBuffer(input)) {
    return input.slice(offset, offset + length);
  }
  const buf = bufferFrom(new Array(length));
  for (let i = 0; i < length; i++) {
    buf[i] = input.readByte(offset + i);
  }
  return buf;
}
var Lzma2Decoder = class {
  /**
  * Reset the dictionary (for stream boundaries)
  */
  resetDictionary() {
    this.lzmaDecoder.resetDictionary();
  }
  /**
  * Reset all probability models (for stream boundaries)
  */
  resetProbabilities() {
    this.lzmaDecoder.resetProbabilities();
  }
  /**
  * Set LZMA properties
  */
  setLcLpPb(lc, lp, pb) {
    return this.lzmaDecoder.setLcLpPb(lc, lp, pb);
  }
  /**
  * Feed uncompressed data to the dictionary (for subsequent LZMA chunks)
  */
  feedUncompressed(data) {
    this.lzmaDecoder.feedUncompressed(data);
  }
  /**
  * Decode raw LZMA data (used internally for LZMA2 chunks)
  * @param input - LZMA compressed data
  * @param offset - Input offset
  * @param outSize - Expected output size
  * @param solid - Use solid mode
  * @returns Decompressed data
  */
  decodeLzmaData(input, offset, outSize, solid = false) {
    return this.lzmaDecoder.decode(input, offset, outSize, solid);
  }
  /**
  * Decode LZMA2 data with streaming output
  * @param input - LZMA2 compressed data (Buffer or BufferList)
  * @returns Total number of bytes written to sink
  */
  decodeWithSink(input) {
    let totalBytes = 0;
    let offset = 0;
    while (true) {
      const result = parseLzma2ChunkHeader(input, offset);
      if (!result.success) {
        throw new Error("Truncated LZMA2 chunk header");
      }
      const chunk = result.chunk;
      if (chunk.type === "end") {
        break;
      }
      if (offset === 0 && !chunk.dictReset) {
        throw new Error("First LZMA2 chunk must reset the dictionary");
      }
      if (chunk.dictReset) {
        this.lzmaDecoder.resetDictionary();
      }
      if (chunk.stateReset) {
        this.lzmaDecoder.resetProbabilities();
      }
      if (chunk.newProps) {
        const { lc, lp, pb } = chunk.newProps;
        this.lzmaDecoder.setLcLpPb(lc, lp, pb);
      }
      const dataOffset = offset + chunk.headerSize;
      const useSolid = !chunk.stateReset || chunk.stateReset && !chunk.dictReset;
      if (chunk.type === "uncompressed") {
        const uncompData = readBytes(input, dataOffset, chunk.uncompSize);
        this.lzmaDecoder.feedUncompressed(uncompData);
        totalBytes += uncompData.length;
        offset = dataOffset + chunk.uncompSize;
      } else {
        totalBytes += this.lzmaDecoder.decodeWithSink(input, dataOffset, chunk.uncompSize, useSolid);
        offset = dataOffset + chunk.compSize;
      }
    }
    this.lzmaDecoder.flushOutWindow();
    return totalBytes;
  }
  /**
  * Decode LZMA2 data
  * @param input - LZMA2 compressed data (Buffer or BufferList)
  * @param unpackSize - Expected output size (optional, for pre-allocation)
  * @returns Decompressed data
  */
  decode(input, unpackSize) {
    let outputBuffer = null;
    let outputPos = 0;
    const outputChunks = [];
    const canPreAllocate = unpackSize && unpackSize > 0 && canAllocateBufferSize(unpackSize);
    if (canPreAllocate) {
      outputBuffer = allocBufferUnsafe(unpackSize);
    }
    let offset = 0;
    while (true) {
      const result = parseLzma2ChunkHeader(input, offset);
      if (!result.success) {
        throw new Error("Truncated LZMA2 chunk header");
      }
      const chunk = result.chunk;
      if (chunk.type === "end") {
        break;
      }
      if (offset === 0 && !chunk.dictReset) {
        throw new Error("First LZMA2 chunk must reset the dictionary");
      }
      const dataOffset = offset + chunk.headerSize;
      if (chunk.dictReset) {
        this.lzmaDecoder.resetDictionary();
      }
      if (chunk.stateReset) {
        this.lzmaDecoder.resetProbabilities();
      }
      if (chunk.newProps) {
        const { lc, lp, pb } = chunk.newProps;
        this.lzmaDecoder.setLcLpPb(lc, lp, pb);
      }
      const useSolid = !chunk.stateReset || chunk.stateReset && !chunk.dictReset;
      if (chunk.type === "uncompressed") {
        const uncompData = readBytes(input, dataOffset, chunk.uncompSize);
        if (outputBuffer) {
          uncompData.copy(outputBuffer, outputPos);
          outputPos += uncompData.length;
        } else {
          outputChunks.push(uncompData);
        }
        this.lzmaDecoder.feedUncompressed(uncompData);
        offset = dataOffset + chunk.uncompSize;
      } else {
        if (outputBuffer) {
          const bytesWritten = this.lzmaDecoder.decodeToBuffer(input, dataOffset, chunk.uncompSize, outputBuffer, outputPos, useSolid);
          outputPos += bytesWritten;
        } else {
          const chunkData = readBytes(input, dataOffset, chunk.compSize);
          const decoded = this.lzmaDecoder.decode(chunkData, 0, chunk.uncompSize, useSolid);
          outputChunks.push(decoded);
        }
        offset = dataOffset + chunk.compSize;
      }
    }
    if (outputBuffer) {
      return outputPos < outputBuffer.length ? outputBuffer.slice(0, outputPos) : outputBuffer;
    }
    return bufferConcat(outputChunks);
  }
  constructor(properties, outputSink) {
    if (!properties || properties.length < 1) {
      throw new Error("LZMA2 requires properties byte");
    }
    this.dictionarySize = parseLzma2DictionarySize(properties[0]);
    this.lzmaDecoder = new LzmaDecoder(outputSink);
    this.lzmaDecoder.setDictionarySize(this.dictionarySize);
  }
};
function decodeLzma2(input, properties, unpackSize, outputSink) {
  if (!outputSink && unpackSize && unpackSize > 0 && !canAllocateBufferSize(unpackSize)) {
    const chunks = [];
    const sink = {
      write(buffer) {
        chunks.push(buffer);
      }
    };
    const decoder2 = new Lzma2Decoder(properties, sink);
    decoder2.decodeWithSink(input);
    return bufferConcat(chunks);
  }
  const decoder = new Lzma2Decoder(properties, outputSink);
  if (outputSink) {
    return decoder.decodeWithSink(input);
  }
  return decoder.decode(input, unpackSize);
}

// server/seasubs-xz-checks.mjs
function crc64(bytes) {
  let lo = -1, hi = -1;
  for (const byte of bytes) {
    lo ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      const carry = lo & 1;
      lo = lo >>> 1 | hi << 31;
      hi >>>= 1;
      if (carry) {
        lo ^= 3615952706;
        hi ^= 3379320725;
      }
    }
  }
  lo = ~lo;
  hi = ~hi;
  return Uint8Array.from([lo, lo >>> 8, lo >>> 16, lo >>> 24, hi, hi >>> 8, hi >>> 16, hi >>> 24]);
}
var K = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
var rotr = (n, bits) => n >>> bits | n << 32 - bits;
function sha256(bytes) {
  const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const length = bytes.length * 8;
  for (let i = 0; i < 4; i++) padded[padded.length - 1 - i] = length >>> i * 8;
  const w = new Int32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const p = offset + i * 4;
      w[i] = padded[p] << 24 | padded[p + 1] << 16 | padded[p + 2] << 8 | padded[p + 3];
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ x >>> 3) + w[i - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ y >>> 10);
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = j + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] | 0;
      const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b ^ a & c ^ b & c) | 0;
      j = g;
      g = f;
      f = e;
      e = d + t1 | 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 | 0;
    }
    [a, b, c, d, e, f, g, j].forEach((v, i) => {
      h[i] = h[i] + v | 0;
    });
  }
  const digest = new Uint8Array(32);
  h.forEach((v, i) => {
    for (let j = 0; j < 4; j++) digest[i * 4 + j] = v >>> 24 - j * 8;
  });
  return digest;
}

// server/seasubs-xz.mjs
var LIMIT = 2 * 1024 * 1024;
function crc(b) {
  let n = 4294967295;
  for (const v of b) {
    n ^= v;
    for (let j = 0; j < 8; j++) n = n >>> 1 ^ (n & 1 ? 3988292384 : 0);
  }
  return (n ^ 4294967295) >>> 0;
}
function requireOk(ok, message) {
  if (!ok) throw new Error("XZ: " + message);
}
function decode(raw) {
  requireOk(raw && raw.length >= 32 && raw.length <= 2 * 1024 * 1024, "input size");
  const b = import_buffer.Buffer.from(raw);
  requireOk(b.slice(0, 6).toString("hex") === "fd377a585a00", "magic");
  const checkId = b[7], checkSize = { 1: 4, 4: 8, 10: 32 }[checkId];
  requireOk(b[6] === 0 && checkSize !== void 0, "unsupported stream flags/check");
  requireOk(crc(b.slice(6, 8)) === b.readUInt32LE(8), "header checksum");
  const footer = b.length - 12;
  requireOk(b.slice(-2).toString() === "YZ" && b[footer + 8] === b[6] && b[footer + 9] === checkId, "footer");
  requireOk(crc(b.slice(footer + 4, footer + 10)) === b.readUInt32LE(footer), "footer checksum");
  const index = footer - (b.readUInt32LE(footer + 4) + 1) * 4;
  requireOk(index >= 12 && index < footer - 4 && b[index] === 0, "index");
  requireOk(crc(b.slice(index, footer - 4)) === b.readUInt32LE(footer - 4), "index checksum");
  let pos = index + 1;
  function vli(end) {
    let n = 0, mul = 1;
    for (let i = 0; i < 5; i++) {
      requireOk(pos < end, "truncated integer");
      const v = b[pos++];
      n += (v & 127) * mul;
      if (!(v & 128)) return n;
      mul *= 128;
    }
    throw new Error("XZ: integer limit");
  }
  const count = vli(footer - 4);
  requireOk(count > 0 && count <= 16, "block count");
  const records = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const packed = vli(footer - 4), unpacked = vli(footer - 4);
    total += unpacked;
    requireOk(packed >= 8 && unpacked > 0 && total <= LIMIT, "output limit");
    records.push({ packed, unpacked });
  }
  requireOk(b.slice(pos, footer - 4).every((v) => v === 0), "index padding");
  const chunks = [];
  let block = 12;
  for (const r of records) {
    const hs = (b[block] + 1) * 4, end = block + hs;
    requireOk(hs >= 8 && end < index && block + Math.ceil(r.packed / 4) * 4 <= index, "block bounds");
    requireOk(crc(b.slice(block, end - 4)) === b.readUInt32LE(end - 4), "block checksum");
    const flags = b[block + 1];
    requireOk((flags & 63) === 0, "only one LZMA2 filter supported");
    pos = block + 2;
    const packedSize = flags & 64 ? vli(end - 4) : null;
    const unpackedSize = flags & 128 ? vli(end - 4) : null;
    requireOk(vli(end - 4) === 33 && vli(end - 4) === 1, "LZMA2 filter");
    const property = b[pos++];
    requireOk(property <= 40, "invalid dictionary property");
    requireOk(pos <= end - 4 && b.slice(pos, end - 4).every((v) => v === 0), "block header padding");
    const size = r.packed - hs - checkSize;
    requireOk(size > 0 && (packedSize === null || packedSize === size) && (unpackedSize === null || unpackedSize === r.unpacked), "sizes");
    const compressed = b.slice(end, end + size);
    let cp = 0, outputSize = 0;
    while (cp < compressed.length) {
      const control = compressed[cp++];
      if (control === 0) {
        requireOk(cp === compressed.length, "trailing LZMA2 data");
        break;
      }
      requireOk(control === 1 || control === 2 || control >= 128, "LZMA2 control");
      requireOk(cp + 2 <= compressed.length, "chunk header");
      let unpack = (compressed[cp++] << 8 | compressed[cp++]) + 1, pack = unpack;
      if (control >= 128) {
        unpack += (control & 31) * 65536;
        requireOk(cp + 2 <= compressed.length, "compressed header");
        pack = (compressed[cp++] << 8 | compressed[cp++]) + 1;
        if (control >= 192) {
          requireOk(cp < compressed.length, "properties");
          cp++;
        }
      }
      outputSize += unpack;
      requireOk(outputSize <= r.unpacked && cp + pack <= compressed.length, "chunk bounds");
      cp += pack;
    }
    requireOk(outputSize === r.unpacked && compressed[compressed.length - 1] === 0, "unpacked size");
    const check = end + size + (4 - (hs + size) % 4) % 4;
    requireOk(check + checkSize === block + Math.ceil(r.packed / 4) * 4 && check + checkSize <= index, "check bounds");
    requireOk(b.slice(end + size, check).every((v) => v === 0), "block padding");
    const out = decodeLzma2(compressed, import_buffer.Buffer.from([Math.min(property, 18)]), r.unpacked);
    requireOk(out.length === r.unpacked, "unpacked size");
    const valid = checkId === 1 ? crc(out) === b.readUInt32LE(check) : import_buffer.Buffer.from(checkId === 4 ? crc64(out) : sha256(out)).equals(b.slice(check, check + checkSize));
    requireOk(valid, "data checksum");
    chunks.push(out);
    block += Math.ceil(r.packed / 4) * 4;
  }
  requireOk(block === index, "block/index alignment");
  return import_buffer.Buffer.concat(chunks).toString("utf8");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decode
});
/*! Bundled license information:

is-windows/index.js:
  (*!
   * is-windows <https://github.com/jonschlinkert/is-windows>
   *
   * Copyright © 2015-2018, Jon Schlinkert.
   * Released under the MIT License.
   *)
*/
