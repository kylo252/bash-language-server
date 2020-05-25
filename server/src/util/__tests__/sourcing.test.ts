import { homedir } from 'os'

import { getSourcedUris } from '../sourcing'

const fileDirectory = '/Users/bash'
const fileUri = `${fileDirectory}/file.sh`

describe('getSourcedUris', () => {
  it('returns an empty set if no files were sourced', () => {
    const result = getSourcedUris({ fileContent: '', fileUri })
    expect(result).toEqual(new Set([]))
  })

  it('returns an empty set if no files were sourced', () => {
    const result = getSourcedUris({
      fileContent: `

      source file-in-path.sh # does not contain a slash (i.e. is maybe somewhere on the path)

      source /bin/f.inc

      source ./x a b c # some arguments

      . ./relative/to-this.sh

      source ~/myscript

      # source ...
    `,
      fileUri,
    })
    expect(result).toEqual(
      new Set([
        `${fileDirectory}/file-in-path.sh`, // as we don't resolve it, we hope it is here
        `${fileDirectory}/bin/f.inc`,
        `${fileDirectory}/x`,
        `${fileDirectory}/relative/to-this.sh`,
        `${homedir()}/myscript`,
      ]),
    )
  })
})
