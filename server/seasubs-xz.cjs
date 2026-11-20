"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "node_modules/base64-js/index.js"(exports) {
    "use strict";
    init_buffer_inject();
    exports.byteLength = byteLength;
    exports.toByteArray = toByteArray;
    exports.fromByteArray = fromByteArray;
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }
    var i;
    var len;
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var validLen = b64.indexOf("=");
      if (validLen === -1) validLen = len2;
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp;
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
      var curByte = 0;
      var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
      var i2;
      for (i2 = 0; i2 < len2; i2 += 4) {
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
        arr[curByte++] = tmp >> 16 & 255;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 2) {
        tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 1) {
        tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      return arr;
    }
    function tripletToBase64(num) {
      return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
      var tmp;
      var output = [];
      for (var i2 = start; i2 < end; i2 += 3) {
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
        output.push(tripletToBase64(tmp));
      }
      return output.join("");
    }
    function fromByteArray(uint8) {
      var tmp;
      var len2 = uint8.length;
      var extraBytes = len2 % 3;
      var parts = [];
      var maxChunkLength = 16383;
      for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      }
      if (extraBytes === 1) {
        tmp = uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
        );
      } else if (extraBytes === 2) {
        tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
        );
      }
      return parts.join("");
    }
  }
});

// node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "node_modules/ieee754/index.js"(exports) {
    init_buffer_inject();
    exports.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? nBytes - 1 : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];
      i += d;
      e = s & (1 << -nBits) - 1;
      s >>= -nBits;
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var i = isLE ? 0 : nBytes - 1;
      var d = isLE ? 1 : -1;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      value = Math.abs(value);
      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }
        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * Math.pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
          e = 0;
        }
      }
      for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
      }
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
      }
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// node_modules/buffer/index.js
var require_buffer = __commonJS({
  "node_modules/buffer/index.js"(exports) {
    "use strict";
    init_buffer_inject();
    var base64 = require_base64_js();
    var ieee754 = require_ieee754();
    var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
    exports.Buffer = Buffer5;
    exports.SlowBuffer = SlowBuffer;
    exports.INSPECT_MAX_BYTES = 50;
    var K_MAX_LENGTH = 2147483647;
    exports.kMaxLength = K_MAX_LENGTH;
    Buffer5.TYPED_ARRAY_SUPPORT = typedArraySupport();
    if (!Buffer5.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
      );
    }
    function typedArraySupport() {
      try {
        const arr = new Uint8Array(1);
        const proto = { foo: function() {
          return 42;
        } };
        Object.setPrototypeOf(proto, Uint8Array.prototype);
        Object.setPrototypeOf(arr, proto);
        return arr.foo() === 42;
      } catch (e) {
        return false;
      }
    }
    Object.defineProperty(Buffer5.prototype, "parent", {
      enumerable: true,
      get: function() {
        if (!Buffer5.isBuffer(this)) return void 0;
        return this.buffer;
      }
    });
    Object.defineProperty(Buffer5.prototype, "offset", {
      enumerable: true,
      get: function() {
        if (!Buffer5.isBuffer(this)) return void 0;
        return this.byteOffset;
      }
    });
    function createBuffer(length) {
      if (length > K_MAX_LENGTH) {
        throw new RangeError('The value "' + length + '" is invalid for option "size"');
      }
      const buf = new Uint8Array(length);
      Object.setPrototypeOf(buf, Buffer5.prototype);
      return buf;
    }
    function Buffer5(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        if (typeof encodingOrOffset === "string") {
          throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
        }
        return allocUnsafe(arg);
      }
      return from(arg, encodingOrOffset, length);
    }
    Buffer5.poolSize = 8192;
    function from(value, encodingOrOffset, length) {
      if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
      }
      if (ArrayBuffer.isView(value)) {
        return fromArrayView(value);
      }
      if (value == null) {
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof value === "number") {
        throw new TypeError(
          'The "value" argument must not be of type number. Received type number'
        );
      }
      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null && valueOf !== value) {
        return Buffer5.from(valueOf, encodingOrOffset, length);
      }
      const b = fromObject(value);
      if (b) return b;
      if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
        return Buffer5.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
      }
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
      );
    }
    Buffer5.from = function(value, encodingOrOffset, length) {
      return from(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer5.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer5, Uint8Array);
    function assertSize(size) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be of type number');
      } else if (size < 0) {
        throw new RangeError('The value "' + size + '" is invalid for option "size"');
      }
    }
    function alloc(size, fill, encoding) {
      assertSize(size);
      if (size <= 0) {
        return createBuffer(size);
      }
      if (fill !== void 0) {
        return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
      }
      return createBuffer(size);
    }
    Buffer5.alloc = function(size, fill, encoding) {
      return alloc(size, fill, encoding);
    };
    function allocUnsafe(size) {
      assertSize(size);
      return createBuffer(size < 0 ? 0 : checked(size) | 0);
    }
    Buffer5.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer5.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    function fromString(string, encoding) {
      if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
      }
      if (!Buffer5.isEncoding(encoding)) {
        throw new TypeError("Unknown encoding: " + encoding);
      }
      const length = byteLength(string, encoding) | 0;
      let buf = createBuffer(length);
      const actual = buf.write(string, encoding);
      if (actual !== length) {
        buf = buf.slice(0, actual);
      }
      return buf;
    }
    function fromArrayLike(array) {
      const length = array.length < 0 ? 0 : checked(array.length) | 0;
      const buf = createBuffer(length);
      for (let i = 0; i < length; i += 1) {
        buf[i] = array[i] & 255;
      }
      return buf;
    }
    function fromArrayView(arrayView) {
      if (isInstance(arrayView, Uint8Array)) {
        const copy = new Uint8Array(arrayView);
        return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
      }
      return fromArrayLike(arrayView);
    }
    function fromArrayBuffer(array, byteOffset, length) {
      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('"offset" is outside of buffer bounds');
      }
      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('"length" is outside of buffer bounds');
      }
      let buf;
      if (byteOffset === void 0 && length === void 0) {
        buf = new Uint8Array(array);
      } else if (length === void 0) {
        buf = new Uint8Array(array, byteOffset);
      } else {
        buf = new Uint8Array(array, byteOffset, length);
      }
      Object.setPrototypeOf(buf, Buffer5.prototype);
      return buf;
    }
    function fromObject(obj) {
      if (Buffer5.isBuffer(obj)) {
        const len = checked(obj.length) | 0;
        const buf = createBuffer(len);
        if (buf.length === 0) {
          return buf;
        }
        obj.copy(buf, 0, 0, len);
        return buf;
      }
      if (obj.length !== void 0) {
        if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
          return createBuffer(0);
        }
        return fromArrayLike(obj);
      }
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return fromArrayLike(obj.data);
      }
    }
    function checked(length) {
      if (length >= K_MAX_LENGTH) {
        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
      }
      return length | 0;
    }
    function SlowBuffer(length) {
      if (+length != length) {
        length = 0;
      }
      return Buffer5.alloc(+length);
    }
    Buffer5.isBuffer = function isBuffer(b) {
      return b != null && b._isBuffer === true && b !== Buffer5.prototype;
    };
    Buffer5.compare = function compare(a, b) {
      if (isInstance(a, Uint8Array)) a = Buffer5.from(a, a.offset, a.byteLength);
      if (isInstance(b, Uint8Array)) b = Buffer5.from(b, b.offset, b.byteLength);
      if (!Buffer5.isBuffer(a) || !Buffer5.isBuffer(b)) {
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      }
      if (a === b) return 0;
      let x = a.length;
      let y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer5.isEncoding = function isEncoding(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return true;
        default:
          return false;
      }
    };
    Buffer5.concat = function concat(list, length) {
      if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      if (list.length === 0) {
        return Buffer5.alloc(0);
      }
      let i;
      if (length === void 0) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }
      const buffer = Buffer5.allocUnsafe(length);
      let pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (isInstance(buf, Uint8Array)) {
          if (pos + buf.length > buffer.length) {
            if (!Buffer5.isBuffer(buf)) buf = Buffer5.from(buf);
            buf.copy(buffer, pos);
          } else {
            Uint8Array.prototype.set.call(
              buffer,
              buf,
              pos
            );
          }
        } else if (!Buffer5.isBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        } else {
          buf.copy(buffer, pos);
        }
        pos += buf.length;
      }
      return buffer;
    };
    function byteLength(string, encoding) {
      if (Buffer5.isBuffer(string)) {
        return string.length;
      }
      if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
        return string.byteLength;
      }
      if (typeof string !== "string") {
        throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
        );
      }
      const len = string.length;
      const mustMatch = arguments.length > 2 && arguments[2] === true;
      if (!mustMatch && len === 0) return 0;
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "ascii":
          case "latin1":
          case "binary":
            return len;
          case "utf8":
          case "utf-8":
            return utf8ToBytes(string).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return len * 2;
          case "hex":
            return len >>> 1;
          case "base64":
            return base64ToBytes(string).length;
          default:
            if (loweredCase) {
              return mustMatch ? -1 : utf8ToBytes(string).length;
            }
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer5.byteLength = byteLength;
    function slowToString(encoding, start, end) {
      let loweredCase = false;
      if (start === void 0 || start < 0) {
        start = 0;
      }
      if (start > this.length) {
        return "";
      }
      if (end === void 0 || end > this.length) {
        end = this.length;
      }
      if (end <= 0) {
        return "";
      }
      end >>>= 0;
      start >>>= 0;
      if (end <= start) {
        return "";
      }
      if (!encoding) encoding = "utf8";
      while (true) {
        switch (encoding) {
          case "hex":
            return hexSlice(this, start, end);
          case "utf8":
          case "utf-8":
            return utf8Slice(this, start, end);
          case "ascii":
            return asciiSlice(this, start, end);
          case "latin1":
          case "binary":
            return latin1Slice(this, start, end);
          case "base64":
            return base64Slice(this, start, end);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return utf16leSlice(this, start, end);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = (encoding + "").toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer5.prototype._isBuffer = true;
    function swap(b, n, m) {
      const i = b[n];
      b[n] = b[m];
      b[m] = i;
    }
    Buffer5.prototype.swap16 = function swap16() {
      const len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      }
      for (let i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this;
    };
    Buffer5.prototype.swap32 = function swap32() {
      const len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this;
    };
    Buffer5.prototype.swap64 = function swap64() {
      const len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      }
      for (let i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this;
    };
    Buffer5.prototype.toString = function toString() {
      const length = this.length;
      if (length === 0) return "";
      if (arguments.length === 0) return utf8Slice(this, 0, length);
      return slowToString.apply(this, arguments);
    };
    Buffer5.prototype.toLocaleString = Buffer5.prototype.toString;
    Buffer5.prototype.equals = function equals(b) {
      if (!Buffer5.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      if (this === b) return true;
      return Buffer5.compare(this, b) === 0;
    };
    Buffer5.prototype.inspect = function inspect() {
      let str = "";
      const max = exports.INSPECT_MAX_BYTES;
      str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
      if (this.length > max) str += " ... ";
      return "<Buffer " + str + ">";
    };
    if (customInspectSymbol) {
      Buffer5.prototype[customInspectSymbol] = Buffer5.prototype.inspect;
    }
    Buffer5.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
      if (isInstance(target, Uint8Array)) {
        target = Buffer5.from(target, target.offset, target.byteLength);
      }
      if (!Buffer5.isBuffer(target)) {
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      }
      if (start === void 0) {
        start = 0;
      }
      if (end === void 0) {
        end = target ? target.length : 0;
      }
      if (thisStart === void 0) {
        thisStart = 0;
      }
      if (thisEnd === void 0) {
        thisEnd = this.length;
      }
      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError("out of range index");
      }
      if (thisStart >= thisEnd && start >= end) {
        return 0;
      }
      if (thisStart >= thisEnd) {
        return -1;
      }
      if (start >= end) {
        return 1;
      }
      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;
      if (this === target) return 0;
      let x = thisEnd - thisStart;
      let y = end - start;
      const len = Math.min(x, y);
      const thisCopy = this.slice(thisStart, thisEnd);
      const targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
      if (buffer.length === 0) return -1;
      if (typeof byteOffset === "string") {
        encoding = byteOffset;
        byteOffset = 0;
      } else if (byteOffset > 2147483647) {
        byteOffset = 2147483647;
      } else if (byteOffset < -2147483648) {
        byteOffset = -2147483648;
      }
      byteOffset = +byteOffset;
      if (numberIsNaN(byteOffset)) {
        byteOffset = dir ? 0 : buffer.length - 1;
      }
      if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      if (byteOffset >= buffer.length) {
        if (dir) return -1;
        else byteOffset = buffer.length - 1;
      } else if (byteOffset < 0) {
        if (dir) byteOffset = 0;
        else return -1;
      }
      if (typeof val === "string") {
        val = Buffer5.from(val, encoding);
      }
      if (Buffer5.isBuffer(val)) {
        if (val.length === 0) {
          return -1;
        }
        return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
      } else if (typeof val === "number") {
        val = val & 255;
        if (typeof Uint8Array.prototype.indexOf === "function") {
          if (dir) {
            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
          } else {
            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
          }
        }
        return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
      }
      throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
      let indexSize = 1;
      let arrLength = arr.length;
      let valLength = val.length;
      if (encoding !== void 0) {
        encoding = String(encoding).toLowerCase();
        if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
          if (arr.length < 2 || val.length < 2) {
            return -1;
          }
          indexSize = 2;
          arrLength /= 2;
          valLength /= 2;
          byteOffset /= 2;
        }
      }
      function read(buf, i2) {
        if (indexSize === 1) {
          return buf[i2];
        } else {
          return buf.readUInt16BE(i2 * indexSize);
        }
      }
      let i;
      if (dir) {
        let foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++) {
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1) foundIndex = i;
            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
          } else {
            if (foundIndex !== -1) i -= i - foundIndex;
            foundIndex = -1;
          }
        }
      } else {
        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
        for (i = byteOffset; i >= 0; i--) {
          let found = true;
          for (let j = 0; j < valLength; j++) {
            if (read(arr, i + j) !== read(val, j)) {
              found = false;
              break;
            }
          }
          if (found) return i;
        }
      }
      return -1;
    }
    Buffer5.prototype.includes = function includes(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer5.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer5.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    function hexWrite(buf, string, offset, length) {
      offset = Number(offset) || 0;
      const remaining = buf.length - offset;
      if (!length) {
        length = remaining;
      } else {
        length = Number(length);
        if (length > remaining) {
          length = remaining;
        }
      }
      const strLen = string.length;
      if (length > strLen / 2) {
        length = strLen / 2;
      }
      let i;
      for (i = 0; i < length; ++i) {
        const parsed = parseInt(string.substr(i * 2, 2), 16);
        if (numberIsNaN(parsed)) return i;
        buf[offset + i] = parsed;
      }
      return i;
    }
    function utf8Write(buf, string, offset, length) {
      return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function base64Write(buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer5.prototype.write = function write(string, offset, length, encoding) {
      if (offset === void 0) {
        encoding = "utf8";
        length = this.length;
        offset = 0;
      } else if (length === void 0 && typeof offset === "string") {
        encoding = offset;
        length = this.length;
        offset = 0;
      } else if (isFinite(offset)) {
        offset = offset >>> 0;
        if (isFinite(length)) {
          length = length >>> 0;
          if (encoding === void 0) encoding = "utf8";
        } else {
          encoding = length;
          length = void 0;
        }
      } else {
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      }
      const remaining = this.length - offset;
      if (length === void 0 || length > remaining) length = remaining;
      if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
        throw new RangeError("Attempt to write outside buffer bounds");
      }
      if (!encoding) encoding = "utf8";
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };
    Buffer5.prototype.toJSON = function toJSON() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    function base64Slice(buf, start, end) {
      if (start === 0 && end === buf.length) {
        return base64.fromByteArray(buf);
      } else {
        return base64.fromByteArray(buf.slice(start, end));
      }
    }
    function utf8Slice(buf, start, end) {
      end = Math.min(buf.length, end);
      const res = [];
      let i = start;
      while (i < end) {
        const firstByte = buf[i];
        let codePoint = null;
        let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
        if (i + bytesPerSequence <= end) {
          let secondByte, thirdByte, fourthByte, tempCodePoint;
          switch (bytesPerSequence) {
            case 1:
              if (firstByte < 128) {
                codePoint = firstByte;
              }
              break;
            case 2:
              secondByte = buf[i + 1];
              if ((secondByte & 192) === 128) {
                tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                if (tempCodePoint > 127) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 3:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 4:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              fourthByte = buf[i + 3];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                  codePoint = tempCodePoint;
                }
              }
          }
        }
        if (codePoint === null) {
          codePoint = 65533;
          bytesPerSequence = 1;
        } else if (codePoint > 65535) {
          codePoint -= 65536;
          res.push(codePoint >>> 10 & 1023 | 55296);
          codePoint = 56320 | codePoint & 1023;
        }
        res.push(codePoint);
        i += bytesPerSequence;
      }
      return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
      const len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH) {
        return String.fromCharCode.apply(String, codePoints);
      }
      let res = "";
      let i = 0;
      while (i < len) {
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      }
      return res;
    }
    function asciiSlice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i] & 127);
      }
      return ret;
    }
    function latin1Slice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i]);
      }
      return ret;
    }
    function hexSlice(buf, start, end) {
      const len = buf.length;
      if (!start || start < 0) start = 0;
      if (!end || end < 0 || end > len) end = len;
      let out = "";
      for (let i = start; i < end; ++i) {
        out += hexSliceLookupTable[buf[i]];
      }
      return out;
    }
    function utf16leSlice(buf, start, end) {
      const bytes = buf.slice(start, end);
      let res = "";
      for (let i = 0; i < bytes.length - 1; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      }
      return res;
    }
    Buffer5.prototype.slice = function slice(start, end) {
      const len = this.length;
      start = ~~start;
      end = end === void 0 ? len : ~~end;
      if (start < 0) {
        start += len;
        if (start < 0) start = 0;
      } else if (start > len) {
        start = len;
      }
      if (end < 0) {
        end += len;
        if (end < 0) end = 0;
      } else if (end > len) {
        end = len;
      }
      if (end < start) end = start;
      const newBuf = this.subarray(start, end);
      Object.setPrototypeOf(newBuf, Buffer5.prototype);
      return newBuf;
    };
    function checkOffset(offset, ext, length) {
      if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
      if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer5.prototype.readUintLE = Buffer5.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      return val;
    };
    Buffer5.prototype.readUintBE = Buffer5.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        checkOffset(offset, byteLength2, this.length);
      }
      let val = this[offset + --byteLength2];
      let mul = 1;
      while (byteLength2 > 0 && (mul *= 256)) {
        val += this[offset + --byteLength2] * mul;
      }
      return val;
    };
    Buffer5.prototype.readUint8 = Buffer5.prototype.readUInt8 = function readUInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset];
    };
    Buffer5.prototype.readUint16LE = Buffer5.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | this[offset + 1] << 8;
    };
    Buffer5.prototype.readUint16BE = Buffer5.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] << 8 | this[offset + 1];
    };
    Buffer5.prototype.readUint32LE = Buffer5.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer5.prototype.readUint32BE = Buffer5.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer5.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
      const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    });
    Buffer5.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    });
    Buffer5.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer5.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let i = byteLength2;
      let mul = 1;
      let val = this[offset + --i];
      while (i > 0 && (mul *= 256)) {
        val += this[offset + --i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer5.prototype.readInt8 = function readInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 128)) return this[offset];
      return (255 - this[offset] + 1) * -1;
    };
    Buffer5.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer5.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer5.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer5.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer5.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    });
    Buffer5.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    });
    Buffer5.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, true, 23, 4);
    };
    Buffer5.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, false, 23, 4);
    };
    Buffer5.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, true, 52, 8);
    };
    Buffer5.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, false, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
      if (!Buffer5.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer5.prototype.writeUintLE = Buffer5.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1;
      let i = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeUintBE = Buffer5.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeUint8 = Buffer5.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer5.prototype.writeUint16LE = Buffer5.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer5.prototype.writeUint16BE = Buffer5.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer5.prototype.writeUint32LE = Buffer5.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 255;
      return offset + 4;
    };
    Buffer5.prototype.writeUint32BE = Buffer5.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    function wrtBigUInt64LE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      return offset;
    }
    function wrtBigUInt64BE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset + 7] = lo;
      lo = lo >> 8;
      buf[offset + 6] = lo;
      lo = lo >> 8;
      buf[offset + 5] = lo;
      lo = lo >> 8;
      buf[offset + 4] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset + 3] = hi;
      hi = hi >> 8;
      buf[offset + 2] = hi;
      hi = hi >> 8;
      buf[offset + 1] = hi;
      hi = hi >> 8;
      buf[offset] = hi;
      return offset + 8;
    }
    Buffer5.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer5.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer5.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0;
      let mul = 1;
      let sub = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      let sub = 0;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer5.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
      if (value < 0) value = 255 + value + 1;
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer5.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer5.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer5.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
      return offset + 4;
    };
    Buffer5.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      if (value < 0) value = 4294967295 + value + 1;
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer5.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    Buffer5.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    function checkIEEE754(buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
      if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
      }
      ieee754.write(buf, value, offset, littleEndian, 23, 4);
      return offset + 4;
    }
    Buffer5.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer5.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
      }
      ieee754.write(buf, value, offset, littleEndian, 52, 8);
      return offset + 8;
    }
    Buffer5.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer5.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer5.prototype.copy = function copy(target, targetStart, start, end) {
      if (!Buffer5.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;
      if (end === start) return 0;
      if (target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0) {
        throw new RangeError("targetStart out of bounds");
      }
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }
      const len = end - start;
      if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
        this.copyWithin(targetStart, start, end);
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, end),
          targetStart
        );
      }
      return len;
    };
    Buffer5.prototype.fill = function fill(val, start, end, encoding) {
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = this.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (typeof encoding === "string" && !Buffer5.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val.length === 1) {
          const code = val.charCodeAt(0);
          if (encoding === "utf8" && code < 128 || encoding === "latin1") {
            val = code;
          }
        }
      } else if (typeof val === "number") {
        val = val & 255;
      } else if (typeof val === "boolean") {
        val = Number(val);
      }
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return this;
      }
      start = start >>> 0;
      end = end === void 0 ? this.length : end >>> 0;
      if (!val) val = 0;
      let i;
      if (typeof val === "number") {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        const bytes = Buffer5.isBuffer(val) ? val : Buffer5.from(val, encoding);
        const len = bytes.length;
        if (len === 0) {
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        }
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }
      return this;
    };
    var errors = {};
    function E(sym, getMessage, Base) {
      errors[sym] = class NodeError extends Base {
        constructor() {
          super();
          Object.defineProperty(this, "message", {
            value: getMessage.apply(this, arguments),
            writable: true,
            configurable: true
          });
          this.name = `${this.name} [${sym}]`;
          this.stack;
          delete this.name;
        }
        get code() {
          return sym;
        }
        set code(value) {
          Object.defineProperty(this, "code", {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        }
        toString() {
          return `${this.name} [${sym}]: ${this.message}`;
        }
      };
    }
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name) {
        if (name) {
          return `${name} is outside of buffer bounds`;
        }
        return "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name, actual) {
        return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`;
        let received = input;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        }
        msg += ` It must be ${range}. Received ${received}`;
        return msg;
      },
      RangeError
    );
    function addNumericalSeparator(val) {
      let res = "";
      let i = val.length;
      const start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
      }
      return `${val.slice(0, i)}${res}`;
    }
    function checkBounds(buf, offset, byteLength2) {
      validateNumber(offset, "offset");
      if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
        boundsError(offset, buf.length - (byteLength2 + 1));
      }
    }
    function checkIntBI(value, min, max, buf, offset, byteLength2) {
      if (value > max || value < min) {
        const n = typeof min === "bigint" ? "n" : "";
        let range;
        if (byteLength2 > 3) {
          if (min === 0 || min === BigInt(0)) {
            range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
          } else {
            range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
          }
        } else {
          range = `>= ${min}${n} and <= ${max}${n}`;
        }
        throw new errors.ERR_OUT_OF_RANGE("value", range, value);
      }
      checkBounds(buf, offset, byteLength2);
    }
    function validateNumber(value, name) {
      if (typeof value !== "number") {
        throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
      }
    }
    function boundsError(value, length, type) {
      if (Math.floor(value) !== value) {
        validateNumber(value, type);
        throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
      }
      if (length < 0) {
        throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
      }
      throw new errors.ERR_OUT_OF_RANGE(
        type || "offset",
        `>= ${type ? 1 : 0} and <= ${length}`,
        value
      );
    }
    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    function base64clean(str) {
      str = str.split("=")[0];
      str = str.trim().replace(INVALID_BASE64_RE, "");
      if (str.length < 2) return "";
      while (str.length % 4 !== 0) {
        str = str + "=";
      }
      return str;
    }
    function utf8ToBytes(string, units) {
      units = units || Infinity;
      let codePoint;
      const length = string.length;
      let leadSurrogate = null;
      const bytes = [];
      for (let i = 0; i < length; ++i) {
        codePoint = string.charCodeAt(i);
        if (codePoint > 55295 && codePoint < 57344) {
          if (!leadSurrogate) {
            if (codePoint > 56319) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            } else if (i + 1 === length) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            }
            leadSurrogate = codePoint;
            continue;
          }
          if (codePoint < 56320) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
            leadSurrogate = codePoint;
            continue;
          }
          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
        } else if (leadSurrogate) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
        }
        leadSurrogate = null;
        if (codePoint < 128) {
          if ((units -= 1) < 0) break;
          bytes.push(codePoint);
        } else if (codePoint < 2048) {
          if ((units -= 2) < 0) break;
          bytes.push(
            codePoint >> 6 | 192,
            codePoint & 63 | 128
          );
        } else if (codePoint < 65536) {
          if ((units -= 3) < 0) break;
          bytes.push(
            codePoint >> 12 | 224,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else if (codePoint < 1114112) {
          if ((units -= 4) < 0) break;
          bytes.push(
            codePoint >> 18 | 240,
            codePoint >> 12 & 63 | 128,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else {
          throw new Error("Invalid code point");
        }
      }
      return bytes;
    }
    function asciiToBytes(str) {
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        byteArray.push(str.charCodeAt(i) & 255);
      }
      return byteArray;
    }
    function utf16leToBytes(str, units) {
      let c, hi, lo;
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        if ((units -= 2) < 0) break;
        c = str.charCodeAt(i);
        hi = c >> 8;
        lo = c % 256;
        byteArray.push(lo);
        byteArray.push(hi);
      }
      return byteArray;
    }
    function base64ToBytes(str) {
      return base64.toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
      let i;
      for (i = 0; i < length; ++i) {
        if (i + offset >= dst.length || i >= src.length) break;
        dst[i + offset] = src[i];
      }
      return i;
    }
    function isInstance(obj, type) {
      return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
    }
    function numberIsNaN(obj) {
      return obj !== obj;
    }
    var hexSliceLookupTable = (function() {
      const alphabet = "0123456789abcdef";
      const table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        const i16 = i * 16;
        for (let j = 0; j < 16; ++j) {
          table[i16 + j] = alphabet[i] + alphabet[j];
        }
      }
      return table;
    })();
    function defineBigIntMethod(fn) {
      return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
    }
    function BufferBigIntNotDefined() {
      throw new Error("BigInt not supported");
    }
  }
});

// buffer-inject.js
var import_buffer;
var init_buffer_inject = __esm({
  "buffer-inject.js"() {
    import_buffer = __toESM(require_buffer());
  }
});

// ../../../../../Documents/Codex/2026-10-04/referenced-chatgpt-conversation-this-is-an/work/ApexAnimehub-sdd-anilist/server/seasubs-xz.mjs
var seasubs_xz_exports = {};
__export(seasubs_xz_exports, {
  decode: () => decode
});
module.exports = __toCommonJS(seasubs_xz_exports);
init_buffer_inject();
var import_buffer3 = __toESM(require_buffer(), 1);

// node_modules/xz-compat/dist/esm/lzma/sync/Lzma2Decoder.js
init_buffer_inject();

// buffer-shim.js
init_buffer_inject();
var import_buffer2 = __toESM(require_buffer());
var allocBufferUnsafe = (n) => {
  if (n > 8 * 1024 * 1024) throw new Error("Allocation limit");
  return import_buffer2.Buffer.alloc(n);
};
var bufferFrom = (v) => import_buffer2.Buffer.from(v);
var bufferConcat = (v) => import_buffer2.Buffer.concat(v);
var canAllocateBufferSize = (n) => n <= 2 * 1024 * 1024;

// node_modules/xz-compat/dist/esm/lzma/lib/Lzma2ChunkParser.js
init_buffer_inject();
function readByte(input, offset) {
  return import_buffer.Buffer.isBuffer(input) ? input[offset] : input.readByte(offset);
}
function getLength(input) {
  return import_buffer.Buffer.isBuffer(input) ? input.length : input.length;
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
init_buffer_inject();
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

// node_modules/xz-compat/dist/esm/lzma/sync/LzmaDecoder.js
init_buffer_inject();

// node_modules/xz-compat/dist/esm/lzma/sync/RangeDecoder.js
init_buffer_inject();
var RangeDecoder = class {
  /**
  * Set input buffer and initialize decoder state
  */
  setInput(input, offset = 0) {
    this.pos = offset;
    this.getByte = import_buffer.Buffer.isBuffer(input) ? (o) => input[o] : (o) => input.readByte(o);
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
  if (import_buffer.Buffer.isBuffer(input)) {
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

// ../../../../../Documents/Codex/2026-10-04/referenced-chatgpt-conversation-this-is-an/work/ApexAnimehub-sdd-anilist/server/seasubs-xz-checks.mjs
init_buffer_inject();
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

// ../../../../../Documents/Codex/2026-10-04/referenced-chatgpt-conversation-this-is-an/work/ApexAnimehub-sdd-anilist/server/seasubs-xz.mjs
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
  const b = import_buffer3.Buffer.from(raw);
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
    const out = decodeLzma2(compressed, import_buffer3.Buffer.from([Math.min(property, 18)]), r.unpacked);
    requireOk(out.length === r.unpacked, "unpacked size");
    const valid = checkId === 1 ? crc(out) === b.readUInt32LE(check) : import_buffer3.Buffer.from(checkId === 4 ? crc64(out) : sha256(out)).equals(b.slice(check, check + checkSize));
    requireOk(valid, "data checksum");
    chunks.push(out);
    block += Math.ceil(r.packed / 4) * 4;
  }
  requireOk(block === index, "block/index alignment");
  return import_buffer3.Buffer.concat(chunks).toString("utf8");
}
/*! Bundled license information:

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/
