import * as fastGlob from 'fast-glob'
import * as os from 'os'

// from https://github.com/sindresorhus/untildify/blob/f85a087418aeaa2beb56fe2684fe3b64fc8c588d/index.js#L11
export function untildify(pathWithTilde: string): string {
  const homeDirectory = os.homedir()
  return homeDirectory
    ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathWithTilde
}

export async function getFilePaths({
  globPattern,
  rootPath,
  maxItems,
}: {
  globPattern: string
  rootPath: string
  maxItems: number
}): Promise<string[]> {
  const stream = fastGlob.stream([globPattern], {
    absolute: true,
    onlyFiles: true,
    cwd: rootPath,
    followSymbolicLinks: true,
    suppressErrors: true,
  })

  // NOTE: we use a stream here to not block the event loop
  // and ensure that we stop reading files if the glob returns
  // too many files.
  const files = []
  let i = 0
  for await (const fileEntry of stream) {
    if (i >= maxItems) {
      break
    }

    files.push(fileEntry.toString())
    i++
  }

  return files
}
