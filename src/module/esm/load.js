import { extname as _extname, dirname } from "path"

import Entry from "../../entry.js"

import _load from "../_load.js"
import extname from "../../path/extname.js"
import getGetter from "../../util/get-getter.js"
import getSourceType from "../../util/get-source-type.js"
import isObject from "../../util/is-object.js"
import moduleState from "../state.js"
import nodeModulePaths from "../node-module-paths.js"
import resolveFilename from "./resolve-filename.js"
import setGetter from "../../util/set-getter.js"

const queryHashRegExp = /[?#].*$/

function load(id, parent, isMain, options) {
  const filePath = resolveFilename(id, parent, isMain, options)

  let child
  let oldChildA
  let oldChildB
  let state
  let cacheId = filePath
  let queryHash = queryHashRegExp.exec(id)

  if (queryHash) {
    cacheId = filePath + queryHash[0]
  }

  if (! (options && options.cjs) &&
      _extname(filePath) === ".mjs") {
    state = moduleState
  } else {
    child = __non_webpack_require__.cache[cacheId]

    if (child &&
        getSourceType(child.exports) === "module" &&
        ! Entry.has(child)) {
      delete __non_webpack_require__.cache[cacheId]
    }
  }

  if (queryHash) {
    child = state
      ? state.cache[cacheId]
      : moduleState.cache[cacheId] || __non_webpack_require__.cache[cacheId]

    if (child) {
      return child
    }

    // Backup existing cache entries because Node uses the child module's file
    // path, without query+hash, as its cache id.
    if (state) {
      oldChildA = pluck(state.cache, filePath)
    } else {
      oldChildA = pluck(moduleState.cache, filePath)
      oldChildB = pluck(__non_webpack_require__.cache, filePath)
    }
  }

  let error
  let threw = true

  try {
    child = _load(filePath, parent, isMain, state, loader)
    threw = false
  } catch (e) {
    error = e
  }

  if (queryHash) {
    if (state) {
      state.cache[cacheId] = child
    } else {
      moduleState.cache[cacheId] = __non_webpack_require__.cache[cacheId] = child
    }

    if (state) {
      restore(state.cache, filePath, oldChildA)
    } else {
      restore(__non_webpack_require__.cache, filePath, oldChildA)
      restore(__non_webpack_require__.cache, filePath, oldChildB)
    }
  }

  if (! threw) {
    return child
  }

  try {
    throw error
  } finally {
    // Unlike CJS, ESM errors are preserved for subsequent loads.
    setGetter(moduleState.cache, cacheId, () => {
      throw error
    })

    delete __non_webpack_require__.cache[cacheId]
  }
}

function loader(filePath) {
  let ext = extname(filePath)
  const { extensions } = moduleState

  if (! ext || typeof extensions[ext] !== "function") {
    ext = ".js"
  }

  const extCompiler = extensions[ext]
  const mod = this

  if (typeof extCompiler !== "function") {
    mod.load(filePath)
    return
  }

  mod.filename = filePath
  mod.paths = nodeModulePaths(dirname(filePath))

  extCompiler.call(extensions, mod, filePath)
  mod.loaded = true
}

function pluck(object, key) {
  let value

  if (key in object) {
    value = getGetter(object, key)

    if (typeof value !== "function") {
      value = object[key]

      if (! isObject(value)) {
        value = void 0
      }
    }

    delete object[key]
  }

  return value
}

function restore(object, key, value) {
  if (value === void 0) {
    delete object[key]
    return
  }

  if (typeof value === "function") {
    setGetter(object, key, value)
  } else {
    object[key] = value
  }
}

export default load
