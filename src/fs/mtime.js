import binding from "../binding"
import { satisfies } from "semver"
import { statSync } from "fs"

const fsBinding = binding.fs
const { getStatValues, stat } = fsBinding
const useGetStatValues = typeof getStatValues === "function"

let statValues
let useMtimeFastPath = typeof stat === "function" &&
  satisfies(process.version, "^6.10.1||>=7.7")

if (useMtimeFastPath) {
  statValues = useGetStatValues
    ? getStatValues.call(fsBinding)
    : new Float64Array(14)
}

function mtime(filePath) {
  if (useMtimeFastPath) {
    try {
      return fastPathMtime(filePath)
    } catch ({ code }) {
      if (code === "ENOENT") {
        return -1
      }

      useMtimeFastPath = false
    }
  }

  return fallbackMtime(filePath)
}

function fallbackMtime(filePath) {
  try {
    return statSync(filePath).mtime.getTime()
  } catch (e) {}
  return -1
}

function fastPathMtime(filePath) {
  // Used to speed up file stats. Modifies the `statValues` typed array,
  // with index 11 being the mtime milliseconds stamp. The speedup comes
  // from not creating Stat objects.
  if (useGetStatValues) {
    stat.call(fsBinding, filePath)
  } else {
    stat.call(fsBinding, filePath, statValues)
  }

  return statValues[11]
}

export default mtime
